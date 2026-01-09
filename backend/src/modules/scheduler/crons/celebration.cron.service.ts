import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { EmailService } from '../../common/email/email.service';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from '../../common/email/constants/email.constants';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import {
  CelebrationResult,
  BirthdayEmailData,
  AnniversaryEmailData,
  CelebrationQueryResult,
} from '../types/celebration.types';
import {
  getBirthdayEmployeesQuery,
  getAnniversaryEmployeesQuery,
  getBirthdayEmployeesForDateQuery,
  getAnniversaryEmployeesForDateQuery,
  getMilestoneMessage,
  isMilestoneYear,
  getYearsText,
} from '../queries/celebration.queries';
import { Environments } from '../../../../env-configs';

@Injectable()
export class CelebrationCronService {
  private readonly logger = new Logger(CelebrationCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly emailService: EmailService,
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 17: Birthday and Work Anniversary Wishes
   *
   * Runs daily at 8:00 AM IST to send personalized wishes.
   *
   * Scenarios Handled:
   * 1. Birthday wishes - Personalized birthday email to employees
   * 2. Work anniversary - Celebrating years of service
   * 3. Milestone years (1, 5, 10, 15, 20, 25, 30, 35, 40) - Special recognition
   * 4. Feb 29 birthdays - Celebrated on Feb 28 in non-leap years
   * 5. Active employees only - Skip inactive/deleted employees
   * 6. No celebrations today - No emails sent
   *
   * Special Considerations:
   * - Warm, personalized messages boost employee morale
   * - Milestone anniversaries deserve special recognition
   * - Sent early morning so employees see it when they start work
   *
   * Recipients:
   * - The employee themselves (direct recipient)
   */
  @Cron(CRON_SCHEDULES.DAILY_8AM_IST)
  async handleBirthdayAnniversaryWishes(): Promise<CelebrationResult | null> {
    const cronName = CRON_NAMES.BIRTHDAY_ANNIVERSARY_WISHES;

    return this.cronLogService.execute(cronName, CronJobType.CELEBRATION, async () => {
      const result: CelebrationResult = {
        birthdaysProcessed: 0,
        anniversariesProcessed: 0,
        birthdayEmailsSent: 0,
        anniversaryEmailsSent: 0,
        recipients: [],
        errors: [],
      };

      // Process birthdays
      const birthdayResult = await this.processBirthdays(cronName);
      result.birthdaysProcessed = birthdayResult.processed;
      result.birthdayEmailsSent = birthdayResult.emailsSent;
      result.recipients.push(...birthdayResult.recipients);
      result.errors.push(...birthdayResult.errors);

      // Process work anniversaries
      const anniversaryResult = await this.processAnniversaries(cronName);
      result.anniversariesProcessed = anniversaryResult.processed;
      result.anniversaryEmailsSent = anniversaryResult.emailsSent;
      result.recipients.push(...anniversaryResult.recipients);
      result.errors.push(...anniversaryResult.errors);

      this.logger.log(
        `[${cronName}] Summary: ${result.birthdaysProcessed} birthdays, ${result.anniversariesProcessed} anniversaries`,
      );

      return result;
    });
  }

  private async processBirthdays(
    cronName: string,
  ): Promise<{ processed: number; emailsSent: number; recipients: string[]; errors: string[] }> {
    const recipients: string[] = [];
    const errors: string[] = [];
    let emailsSent = 0;

    try {
      const { query, params } = getBirthdayEmployeesQuery();
      const birthdayEmployees: CelebrationQueryResult[] = await this.dataSource.query(
        query,
        params,
      );

      if (birthdayEmployees.length === 0) {
        this.logger.log(`[${cronName}] No birthdays today`);
        return { processed: 0, emailsSent: 0, recipients: [], errors: [] };
      }

      this.logger.log(`[${cronName}] Found ${birthdayEmployees.length} birthdays today`);

      for (const employee of birthdayEmployees) {
        try {
          const emailData: BirthdayEmailData = {
            employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
            firstName: employee.firstName,
            currentYear: new Date().getFullYear(),
            adminPortalUrl: Environments.FE_BASE_URL || '#',
          };

          await this.emailService.sendMail({
            receiverEmails: employee.email,
            subject: EMAIL_SUBJECT.BIRTHDAY_WISH,
            template: EMAIL_TEMPLATE.BIRTHDAY_WISH,
            emailData,
          });

          this.logger.log(`[${cronName}] 🎂 Birthday wish sent to: ${employee.email}`);
          recipients.push(employee.email);
          emailsSent++;
        } catch (error) {
          const errorMsg = `Failed to send birthday wish to ${employee.email}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[${cronName}] ${errorMsg}`, error);
        }
      }

      return { processed: birthdayEmployees.length, emailsSent, recipients, errors };
    } catch (error) {
      errors.push(`Birthday query failed: ${error.message}`);
      return { processed: 0, emailsSent: 0, recipients: [], errors };
    }
  }

  private async processAnniversaries(
    cronName: string,
  ): Promise<{ processed: number; emailsSent: number; recipients: string[]; errors: string[] }> {
    const recipients: string[] = [];
    const errors: string[] = [];
    let emailsSent = 0;

    try {
      const { query, params } = getAnniversaryEmployeesQuery();
      const anniversaryEmployees: (CelebrationQueryResult & { yearsOfService: number })[] =
        await this.dataSource.query(query, params);

      if (anniversaryEmployees.length === 0) {
        this.logger.log(`[${cronName}] No work anniversaries today`);
        return { processed: 0, emailsSent: 0, recipients: [], errors: [] };
      }

      this.logger.log(
        `[${cronName}] Found ${anniversaryEmployees.length} work anniversaries today`,
      );

      for (const employee of anniversaryEmployees) {
        try {
          const yearsOfService = employee.yearsOfService;
          const milestone = isMilestoneYear(yearsOfService);
          const milestoneMessage = getMilestoneMessage(yearsOfService);

          const emailData: AnniversaryEmailData = {
            employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
            firstName: employee.firstName,
            yearsOfService,
            yearsText: getYearsText(yearsOfService),
            isMilestone: milestone,
            milestoneMessage: milestoneMessage || undefined,
            dateOfJoining: this.formatDate(employee.dateOfJoining!),
            currentYear: new Date().getFullYear(),
            adminPortalUrl: Environments.FE_BASE_URL || '#',
          };

          const subject = milestone
            ? EMAIL_SUBJECT.WORK_ANNIVERSARY_MILESTONE
            : EMAIL_SUBJECT.WORK_ANNIVERSARY;

          await this.emailService.sendMail({
            receiverEmails: employee.email,
            subject: subject.replace('{years}', getYearsText(yearsOfService)),
            template: EMAIL_TEMPLATE.WORK_ANNIVERSARY,
            emailData,
          });

          const emoji = milestone ? '🌟' : '🎉';
          this.logger.log(
            `[${cronName}] ${emoji} Work anniversary (${yearsOfService} yrs) wish sent to: ${employee.email}`,
          );
          recipients.push(employee.email);
          emailsSent++;
        } catch (error) {
          const errorMsg = `Failed to send anniversary wish to ${employee.email}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[${cronName}] ${errorMsg}`, error);
        }
      }

      return { processed: anniversaryEmployees.length, emailsSent, recipients, errors };
    } catch (error) {
      errors.push(`Anniversary query failed: ${error.message}`);
      return { processed: 0, emailsSent: 0, recipients: [], errors };
    }
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Manual trigger for birthday/anniversary wishes for a specific date
   */
  async handleBirthdayAnniversaryWishesManual(targetDate?: string): Promise<CelebrationResult> {
    const cronName = CRON_NAMES.BIRTHDAY_ANNIVERSARY_WISHES;

    const result: CelebrationResult = {
      birthdaysProcessed: 0,
      anniversariesProcessed: 0,
      birthdayEmailsSent: 0,
      anniversaryEmailsSent: 0,
      recipients: [],
      errors: [],
    };

    const dateToProcess: string = targetDate || this.schedulerService.getTodayStringIST();
    this.logger.log(
      `[${cronName}] Manual trigger: Processing celebrations for date ${dateToProcess}`,
    );

    // Process birthdays
    const birthdayResult = await this.processBirthdaysForDate(cronName, dateToProcess);
    result.birthdaysProcessed = birthdayResult.processed;
    result.birthdayEmailsSent = birthdayResult.emailsSent;
    result.recipients.push(...birthdayResult.recipients);
    result.errors.push(...birthdayResult.errors);

    // Process work anniversaries
    const anniversaryResult = await this.processAnniversariesForDate(cronName, dateToProcess);
    result.anniversariesProcessed = anniversaryResult.processed;
    result.anniversaryEmailsSent = anniversaryResult.emailsSent;
    result.recipients.push(...anniversaryResult.recipients);
    result.errors.push(...anniversaryResult.errors);

    this.logger.log(
      `[${cronName}] Manual trigger summary: ${result.birthdaysProcessed} birthdays, ${result.anniversariesProcessed} anniversaries for ${dateToProcess}`,
    );

    return result;
  }

  private async processBirthdaysForDate(
    cronName: string,
    targetDate: string,
  ): Promise<{ processed: number; emailsSent: number; recipients: string[]; errors: string[] }> {
    const recipients: string[] = [];
    const errors: string[] = [];
    let emailsSent = 0;

    try {
      const { query, params } = getBirthdayEmployeesForDateQuery(targetDate);
      const birthdayEmployees: CelebrationQueryResult[] = await this.dataSource.query(
        query,
        params,
      );

      if (birthdayEmployees.length === 0) {
        this.logger.log(`[${cronName}] No birthdays on ${targetDate}`);
        return { processed: 0, emailsSent: 0, recipients: [], errors: [] };
      }

      this.logger.log(`[${cronName}] Found ${birthdayEmployees.length} birthdays on ${targetDate}`);

      for (const employee of birthdayEmployees) {
        try {
          const emailData: BirthdayEmailData = {
            employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
            firstName: employee.firstName,
            currentYear: new Date().getFullYear(),
            adminPortalUrl: Environments.FE_BASE_URL || '#',
          };

          await this.emailService.sendMail({
            receiverEmails: employee.email,
            subject: EMAIL_SUBJECT.BIRTHDAY_WISH,
            template: EMAIL_TEMPLATE.BIRTHDAY_WISH,
            emailData,
          });

          this.logger.log(`[${cronName}] 🎂 Birthday wish sent to: ${employee.email}`);
          recipients.push(employee.email);
          emailsSent++;
        } catch (error) {
          const errorMsg = `Failed to send birthday wish to ${employee.email}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[${cronName}] ${errorMsg}`, error);
        }
      }

      return { processed: birthdayEmployees.length, emailsSent, recipients, errors };
    } catch (error) {
      errors.push(`Birthday query failed: ${error.message}`);
      return { processed: 0, emailsSent: 0, recipients: [], errors };
    }
  }

  private async processAnniversariesForDate(
    cronName: string,
    targetDate: string,
  ): Promise<{ processed: number; emailsSent: number; recipients: string[]; errors: string[] }> {
    const recipients: string[] = [];
    const errors: string[] = [];
    let emailsSent = 0;

    try {
      const { query, params } = getAnniversaryEmployeesForDateQuery(targetDate);
      const anniversaryEmployees: (CelebrationQueryResult & { yearsOfService: number })[] =
        await this.dataSource.query(query, params);

      if (anniversaryEmployees.length === 0) {
        this.logger.log(`[${cronName}] No work anniversaries on ${targetDate}`);
        return { processed: 0, emailsSent: 0, recipients: [], errors: [] };
      }

      this.logger.log(
        `[${cronName}] Found ${anniversaryEmployees.length} work anniversaries on ${targetDate}`,
      );

      for (const employee of anniversaryEmployees) {
        try {
          const yearsOfService = employee.yearsOfService;
          const milestone = isMilestoneYear(yearsOfService);
          const milestoneMessage = getMilestoneMessage(yearsOfService);

          const emailData: AnniversaryEmailData = {
            employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
            firstName: employee.firstName,
            yearsOfService,
            yearsText: getYearsText(yearsOfService),
            isMilestone: milestone,
            milestoneMessage: milestoneMessage || undefined,
            dateOfJoining: this.formatDate(employee.dateOfJoining!),
            currentYear: new Date().getFullYear(),
            adminPortalUrl: Environments.FE_BASE_URL || '#',
          };

          const subject = milestone
            ? EMAIL_SUBJECT.WORK_ANNIVERSARY_MILESTONE
            : EMAIL_SUBJECT.WORK_ANNIVERSARY;

          await this.emailService.sendMail({
            receiverEmails: employee.email,
            subject: subject.replace('{years}', getYearsText(yearsOfService)),
            template: EMAIL_TEMPLATE.WORK_ANNIVERSARY,
            emailData,
          });

          const emoji = milestone ? '🌟' : '🎉';
          this.logger.log(
            `[${cronName}] ${emoji} Work anniversary (${yearsOfService} yrs) wish sent to: ${employee.email}`,
          );
          recipients.push(employee.email);
          emailsSent++;
        } catch (error) {
          const errorMsg = `Failed to send anniversary wish to ${employee.email}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[${cronName}] ${errorMsg}`, error);
        }
      }

      return { processed: anniversaryEmployees.length, emailsSent, recipients, errors };
    } catch (error) {
      errors.push(`Anniversary query failed: ${error.message}`);
      return { processed: 0, emailsSent: 0, recipients: [], errors };
    }
  }
}
