import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../../utils/master-constants/master-constants';
import { FYLeaveConfigReminderResult, FYLeaveConfigAutoCopyResult } from '../types';

@Injectable()
export class LeaveCronService {
  private readonly logger = new Logger(LeaveCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

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

  /**
   * CRON 4: Financial Year Leave Config Auto Copy
   * Runs on April 1 at 12:00 AM IST (6:30 PM UTC previous day)
   *
   * If leave config for new FY is not updated, copies previous year's config
   * Special handling for holiday_calendar: sets holidays to empty array
   */
  @Cron(CRON_SCHEDULES.APRIL_1_MIDNIGHT_IST)
  async handleFYLeaveConfigAutoCopy(): Promise<FYLeaveConfigAutoCopyResult> {
    const cronName = CRON_NAMES.FY_LEAVE_CONFIG_AUTO_COPY;
    this.schedulerService.logCronStart(cronName);

    const result: FYLeaveConfigAutoCopyResult = {
      configsCopied: 0,
      configsSkipped: 0,
      errors: [],
    };

    try {
      const currentDate = this.schedulerService.getCurrentDateIST();
      const { previousFY, currentFY, newFYEffectiveFrom, newFYEffectiveTo } =
        this.calculateFYDates(currentDate);

      this.logger.log(`[${cronName}] Previous FY: ${previousFY}, Current FY: ${currentFY}`);

      // Get all leave-related configurations
      const leaveConfigurations = await this.getLeaveConfigurations();

      if (leaveConfigurations.length === 0) {
        this.logger.warn(`[${cronName}] No leave configurations found`);
        this.schedulerService.logCronComplete(cronName, result);
        return result;
      }

      await this.dataSource.transaction(async (entityManager) => {
        for (const config of leaveConfigurations) {
          try {
            // Check if config already exists for new FY
            const existingNewFYConfig = await this.configSettingService.findOne({
              where: {
                configId: config.id,
                contextKey: currentFY,
              },
            });

            if (existingNewFYConfig) {
              this.logger.log(
                `[${cronName}] Config ${config.key} already exists for ${currentFY} - skipping`,
              );
              result.configsSkipped++;
              continue;
            }

            // Get previous FY config to copy from
            const previousFYConfig = await this.configSettingService.findOne({
              where: {
                configId: config.id,
                contextKey: previousFY,
              },
            });

            if (!previousFYConfig) {
              this.logger.warn(
                `[${cronName}] No previous FY config found for ${config.key} (${previousFY}) - skipping`,
              );
              result.errors.push(`No previous FY config for ${config.key}`);
              continue;
            }

            // Prepare new config value (special handling for holiday_calendar)
            const newValue = this.prepareNewFYConfigValue(config.key, previousFYConfig.value);

            // Create new config setting for current FY
            // isActive: false - will be activated by Config Activation Cron based on effectiveFrom
            await this.configSettingService.create(
              {
                configId: config.id,
                contextKey: currentFY,
                value: newValue,
                effectiveFrom: newFYEffectiveFrom,
                effectiveTo: newFYEffectiveTo,
                isSystemOperation: true,
                isActive: false,
              },
              entityManager,
            );

            this.logger.log(`[${cronName}] Copied config ${config.key} to ${currentFY}`);
            result.configsCopied++;
          } catch (error) {
            result.errors.push(`Failed to copy ${config.key}: ${error.message}`);
            this.logger.error(`[${cronName}] Failed to copy config ${config.key}`, error);
          }
        }
      });

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private calculateFYDates(currentDate: Date): {
    previousFY: string;
    currentFY: string;
    newFYEffectiveFrom: string;
    newFYEffectiveTo: string;
  } {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // If April or later, we're in FY year-(year+1)
    // If Jan-March, we're in FY (year-1)-year
    let fyStartYear: number;
    if (month >= 3) {
      // April onwards
      fyStartYear = year;
    } else {
      // Jan-March
      fyStartYear = year - 1;
    }

    const previousFYStartYear = fyStartYear - 1;

    return {
      previousFY: `${previousFYStartYear}-${previousFYStartYear + 1}`,
      currentFY: `${fyStartYear}-${fyStartYear + 1}`,
      newFYEffectiveFrom: `${fyStartYear}-04-01`,
      newFYEffectiveTo: `${fyStartYear + 1}-03-31`,
    };
  }

  private async getLeaveConfigurations(): Promise<Array<{ id: string; key: string }>> {
    const configurations = await this.configurationService.findAll({
      where: {
        module: CONFIGURATION_MODULES.LEAVE,
      },
    });

    return configurations.records.map((config) => ({
      id: config.id,
      key: config.key,
    }));
  }

  private prepareNewFYConfigValue(configKey: string, previousValue: any): any {
    if (configKey === CONFIGURATION_KEYS.HOLIDAY_CALENDAR) {
      return {
        ...previousValue,
        holidays: [],
      };
    }

    return previousValue;
  }
}
