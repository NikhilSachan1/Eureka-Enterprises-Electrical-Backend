import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { PayrollService } from '../../payroll/payroll.service';
import { PayrollStatus, PAYROLL_ERRORS } from '../../payroll/constants/payroll.constants';
import { UserStatus } from '../../users/constants/user.constants';
import {
  CRON_SCHEDULES,
  CRON_NAMES,
  SYSTEM_DEFAULTS,
  CronProcessStatus,
} from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import { MonthlyPayrollGenerationResult } from '../types/payroll.types';
import {
  getEligibleUsersForPayrollQuery,
  checkExistingPayrollQuery,
} from '../queries/payroll.queries';

@Injectable()
export class PayrollCronService {
  private readonly logger = new Logger(PayrollCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly payrollService: PayrollService,
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 8: Monthly Payroll Generation
   *
   * Runs on 2nd of every month at 1:00 AM IST
   * Generates DRAFT payroll for all active employees for the PREVIOUS month
   *
   * This ensures:
   * - Auto-approve leaves has completed (1st 12:00 AM)
   * - Leave accrual has completed (1st 12:30 AM)
   * - All attendance data is finalized
   *
   * Workflow: DRAFT → GENERATED → APPROVED → PAID
   */
  @Cron(CRON_SCHEDULES.MONTHLY_SECOND_1AM_IST)
  async handleMonthlyPayrollGeneration(): Promise<MonthlyPayrollGenerationResult | null> {
    const cronName = CRON_NAMES.MONTHLY_PAYROLL_GENERATION;

    const currentDate = this.schedulerService.getCurrentDateIST();
    const { month, year } = this.getPreviousMonth(currentDate);

    return this.cronLogService.execute(cronName, CronJobType.PAYROLL, async () => {
      const result: MonthlyPayrollGenerationResult = {
        month,
        year,
        totalProcessed: 0,
        activeUsersProcessed: 0,
        archivedUsersProcessed: 0,
        successCount: 0,
        skippedCount: 0,
        failedCount: 0,
        skipped: [],
        errors: [],
      };

      this.logger.log(`[${cronName}] Generating DRAFT payroll for ${month}/${year}`);

      const { query, params } = getEligibleUsersForPayrollQuery(month, year);
      const eligibleUsers = await this.dataSource.query(query, params);

      if (eligibleUsers.length === 0) {
        this.logger.warn(`[${cronName}] No eligible users found for payroll generation`);
        return result;
      }

      const activeUsers = eligibleUsers.filter((u: any) => u.userStatus === UserStatus.ACTIVE);
      const archivedUsers = eligibleUsers.filter((u: any) => u.userStatus === UserStatus.ARCHIVED);

      this.logger.log(
        `[${cronName}] Found ${eligibleUsers.length} eligible users (Active: ${activeUsers.length}, Archived: ${archivedUsers.length})`,
      );

      result.totalProcessed = eligibleUsers.length;
      result.activeUsersProcessed = activeUsers.length;
      result.archivedUsersProcessed = archivedUsers.length;

      for (const user of eligibleUsers) {
        const processResult = await this.processUserPayroll(user.userId, month, year, cronName);

        if (processResult.status === CronProcessStatus.SUCCESS) {
          result.successCount++;
        } else if (processResult.status === CronProcessStatus.SKIPPED) {
          result.skippedCount++;
          result.skipped.push({
            userId: user.userId,
            reason: processResult.reason,
          });
        } else {
          result.failedCount++;
          result.errors.push({
            userId: user.userId,
            error: processResult.reason,
          });
        }
      }

      this.logger.log(
        `[${cronName}] Completed: Success=${result.successCount}, Skipped=${result.skippedCount}, Failed=${result.failedCount}`,
      );

      return result;
    });
  }

  private async processUserPayroll(
    userId: string,
    month: number,
    year: number,
    cronName: string,
  ): Promise<{ status: CronProcessStatus; reason?: string }> {
    try {
      const { query: checkQuery, params: checkParams } = checkExistingPayrollQuery(
        userId,
        month,
        year,
      );
      const existingPayroll = await this.dataSource.query(checkQuery, checkParams);

      if (existingPayroll && existingPayroll.length > 0) {
        this.logger.debug(`[${cronName}] Payroll already exists for user ${userId} - skipping`);
        return { status: CronProcessStatus.SKIPPED, reason: PAYROLL_ERRORS.ALREADY_EXISTS };
      }

      await this.payrollService.generatePayroll(
        { userId, month, year },
        SYSTEM_DEFAULTS.SYSTEM_USER_ID,
        PayrollStatus.DRAFT,
      );

      this.logger.debug(`[${cronName}] Generated DRAFT payroll for user ${userId}`);
      return { status: CronProcessStatus.SUCCESS };
    } catch (error) {
      if (error.message === PAYROLL_ERRORS.NO_SALARY_STRUCTURE) {
        return { status: CronProcessStatus.SKIPPED, reason: PAYROLL_ERRORS.NO_SALARY_STRUCTURE };
      }

      if (error.message === PAYROLL_ERRORS.ALREADY_EXISTS) {
        return { status: CronProcessStatus.SKIPPED, reason: PAYROLL_ERRORS.ALREADY_EXISTS };
      }

      this.logger.error(`[${cronName}] Failed to generate payroll for user ${userId}`, error);
      return { status: CronProcessStatus.FAILED, reason: error.message };
    }
  }

  private getPreviousMonth(date: Date): { month: number; year: number } {
    const currentMonth = date.getMonth() + 1;
    const currentYear = date.getFullYear();

    if (currentMonth === 1) {
      return { month: 12, year: currentYear - 1 };
    }

    return { month: currentMonth - 1, year: currentYear };
  }

  /**
   * Manual trigger method for generating payroll for a specific month/year
   * Can optionally target a specific user
   */
  async handleMonthlyPayrollGenerationManual(
    targetMonth?: number,
    targetYear?: number,
    userId?: string,
  ): Promise<MonthlyPayrollGenerationResult> {
    const cronName = CRON_NAMES.MONTHLY_PAYROLL_GENERATION;

    // Use provided month/year or default to previous month
    let month = targetMonth;
    let year = targetYear;

    if (!month || !year) {
      const currentDate = this.schedulerService.getCurrentDateIST();
      const prev = this.getPreviousMonth(currentDate);
      month = month || prev.month;
      year = year || prev.year;
    }

    const result: MonthlyPayrollGenerationResult = {
      month,
      year,
      totalProcessed: 0,
      activeUsersProcessed: 0,
      archivedUsersProcessed: 0,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      skipped: [],
      errors: [],
    };

    this.logger.log(`[${cronName}] Manual trigger: Generating DRAFT payroll for ${month}/${year}`);

    // If specific user, process only that user
    if (userId) {
      const processResult = await this.processUserPayroll(userId, month, year, cronName);
      result.totalProcessed = 1;

      if (processResult.status === CronProcessStatus.SUCCESS) {
        result.successCount++;
      } else if (processResult.status === CronProcessStatus.SKIPPED) {
        result.skippedCount++;
        result.skipped.push({ userId, reason: processResult.reason });
      } else {
        result.failedCount++;
        result.errors.push({ userId, error: processResult.reason });
      }

      return result;
    }

    // Process all eligible users
    const { query, params } = getEligibleUsersForPayrollQuery(month, year);
    const eligibleUsers = await this.dataSource.query(query, params);

    if (eligibleUsers.length === 0) {
      this.logger.warn(`[${cronName}] No eligible users found for payroll generation`);
      return result;
    }

    const activeUsers = eligibleUsers.filter((u: any) => u.userStatus === UserStatus.ACTIVE);
    const archivedUsers = eligibleUsers.filter((u: any) => u.userStatus === UserStatus.ARCHIVED);

    result.totalProcessed = eligibleUsers.length;
    result.activeUsersProcessed = activeUsers.length;
    result.archivedUsersProcessed = archivedUsers.length;

    for (const user of eligibleUsers) {
      const processResult = await this.processUserPayroll(user.userId, month, year, cronName);

      if (processResult.status === CronProcessStatus.SUCCESS) {
        result.successCount++;
      } else if (processResult.status === CronProcessStatus.SKIPPED) {
        result.skippedCount++;
        result.skipped.push({ userId: user.userId, reason: processResult.reason });
      } else {
        result.failedCount++;
        result.errors.push({ userId: user.userId, error: processResult.reason });
      }
    }

    this.logger.log(
      `[${cronName}] Manual trigger completed: Success=${result.successCount}, Skipped=${result.skippedCount}, Failed=${result.failedCount}`,
    );

    return result;
  }
}
