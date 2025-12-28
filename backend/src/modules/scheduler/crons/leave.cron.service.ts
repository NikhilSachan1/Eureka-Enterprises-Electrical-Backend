import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchedulerService } from '../scheduler.service';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import { FYLeaveConfigReminderResult } from '../types';

@Injectable()
export class LeaveCronService {
  private readonly logger = new Logger(LeaveCronService.name);

  constructor(private readonly schedulerService: SchedulerService) {}

  /**
   * CRON 3: Financial Year Leave Config Change Reminder
   * Runs DAILY at 9:00 AM IST from March 15 to March 31
   *
   * Sends email reminder to HR/Admin about reviewing leave configurations
   * before the new financial year starts on April 1st
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_IST)
  async handleFYLeaveConfigReminder(): Promise<FYLeaveConfigReminderResult | null> {
    const cronName = CRON_NAMES.FY_LEAVE_CONFIG_REMINDER;

    const result: FYLeaveConfigReminderResult = {
      emailsSent: 0,
      recipients: [],
      errors: [],
    };

    try {
      const currentDate = this.schedulerService.getCurrentDateIST();
      const currentMonth = currentDate.getMonth(); // 0-indexed (2 = March)
      const currentDay = currentDate.getDate();

      // Only run from March 15 to March 31
      if (currentMonth !== 2 || currentDay < 15) {
        this.logger.log(`[${cronName}] Skipping - not in reminder window`);
        return null;
      }

      this.schedulerService.logCronStart(cronName);

      const nextFYStart = new Date(currentDate.getFullYear(), 3, 1); // April 1
      const daysRemaining = Math.ceil(
        (nextFYStart.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      // TODO: Replace with actual email service integration
      // TODO: Fetch HR/Admin emails from user roles
      // TODO: Make email template configurable
      const hrEmails = ['hr@company.com']; // Hardcoded for now

      const emailSubject = `[Action Required] Review Leave Configuration for FY ${this.getNextFinancialYearLabel()}`;
      const emailBody = this.buildFYReminderEmailBody(daysRemaining);

      for (const email of hrEmails) {
        try {
          // TODO: Integrate with actual email service
          // await this.emailService.sendEmail({
          //   to: email,
          //   subject: emailSubject,
          //   body: emailBody,
          // });

          this.logger.log(`[${cronName}] Email would be sent to: ${email}`);
          this.logger.log(`[${cronName}] Subject: ${emailSubject}`);
          this.logger.log(`[${cronName}] Body: ${emailBody}`);

          result.recipients.push(email);
          result.emailsSent++;
        } catch (error) {
          result.errors.push(`Failed to send email to ${email}: ${error.message}`);
          this.logger.error(`[${cronName}] Failed to send email to ${email}`, error);
        }
      }

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private getNextFinancialYearLabel(): string {
    const currentDate = this.schedulerService.getCurrentDateIST();
    const currentYear = currentDate.getFullYear();
    // If we're in Jan-Mar, next FY starts this year
    // If we're in Apr-Dec, next FY starts next year
    const fyStartYear = currentDate.getMonth() < 3 ? currentYear : currentYear + 1;
    return `${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;
  }

  private buildFYReminderEmailBody(daysRemaining: number): string {
    const nextFY = this.getNextFinancialYearLabel();

    // TODO: Replace with proper email template
    return `
Dear HR Team,

This is a reminder that the new Financial Year (${nextFY}) will begin in ${daysRemaining} days.

Please review and update the following leave configurations before April 1st:

1. Leave Types & Quotas
   - Review leave types (Casual Leave, Earned Leave, Sick Leave, etc.)
   - Update annual quotas for each leave type
   - Configure leave encashment policies

2. Holiday Calendar
   - Add holidays for the new financial year
   - Review and update regional holidays if applicable

3. Leave Policies
   - Review carry forward limits
   - Update leave accrual rules
   - Configure leave approval workflows

4. Leave Balance Carry Forward
   - Verify carry forward settings for each leave type
   - Set maximum carry forward limits

If no changes are made by March 31st, the current year's configuration will be automatically copied to the new financial year.

Please login to the admin portal to make necessary updates.

Best regards,
HR Management System

---
This is an automated reminder. Please do not reply to this email.
    `.trim();
  }
}
