import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import { CRON_SCHEDULES, CRON_NAMES, SYSTEM_NOTES } from '../constants/scheduler.constants';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../../utils/master-constants/master-constants';
import {
  FYLeaveConfigReminderResult,
  FYLeaveConfigAutoCopyResult,
  LeaveCarryForwardResult,
  AutoApproveLeavesResult,
  MonthlyLeaveAccrualResult,
} from '../types';
import {
  getPendingLeavesForPeriodQuery,
  autoApproveLeaveQuery,
  getActiveUsersQuery,
  getUserLeaveBalanceQuery,
  updateLeaveBalanceQuery,
  createLeaveBalanceQuery,
} from '../queries';
import { UtilityService } from '../../../utils/utility/utility.service';

@Injectable()
export class LeaveCronService {
  private readonly logger = new Logger(LeaveCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
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

  /**
   * CRON 5: Leave Carry Forward
   * Runs on April 1 at 1:00 AM IST (after config copy cron)
   *
   * Carries forward eligible leaves from previous FY to new FY
   * Only processes leave types where carryForward: true in config
   *
   * NOTE: Currently a placeholder - actual carry forward logic not implemented
   * as it's not required for the current org. Will be implemented when needed.
   */
  @Cron(CRON_SCHEDULES.APRIL_1_1AM_IST)
  async handleLeaveCarryForward(): Promise<LeaveCarryForwardResult> {
    const cronName = CRON_NAMES.LEAVE_CARRY_FORWARD;
    this.schedulerService.logCronStart(cronName);

    const result: LeaveCarryForwardResult = {
      usersProcessed: 0,
      leavesCarriedForward: 0,
      errors: [],
    };

    try {
      const currentDate = this.schedulerService.getCurrentDateIST();
      const { currentFY } = this.calculateFYDates(currentDate);

      // Get leave categories config for current FY
      const leaveCategoriesConfig = await this.getLeaveCategoriesConfig(currentFY);

      if (!leaveCategoriesConfig) {
        this.logger.warn(`[${cronName}] No leave categories config found for ${currentFY}`);
        this.schedulerService.logCronComplete(cronName, result);
        return result;
      }

      // Check each leave category for carryForward flag
      const leaveCategories = Object.keys(leaveCategoriesConfig);

      for (const category of leaveCategories) {
        const categoryConfig = leaveCategoriesConfig[category]?.actual;

        if (!categoryConfig) {
          this.logger.warn(`[${cronName}] No config found for category: ${category}`);
          continue;
        }

        const isCarryForwardAllowed = categoryConfig.carryForward === true;

        if (!isCarryForwardAllowed) {
          this.logger.log(
            `[${cronName}] Skipping ${category} - carryForward not allowed (carryForward: ${categoryConfig.carryForward})`,
          );
          continue;
        }

        // TODO: Implement actual carry forward logic when required
        // This would involve:
        // 1. Get all users' leave balances for previous FY
        // 2. Calculate carry forward amount (respecting maxCarryForward limit if any)
        // 3. Add to new FY balance
        // 4. Create audit/history records

        this.logger.log(
          `[${cronName}] ${category} has carryForward: true - would carry forward (NOT IMPLEMENTED)`,
        );
      }

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private async getLeaveCategoriesConfig(financialYear: string): Promise<any | null> {
    try {
      const leaveCategoriesConfiguration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.LEAVE,
          key: CONFIGURATION_KEYS.LEAVE_CATEGORIES_CONFIG,
        },
      });

      if (!leaveCategoriesConfiguration) {
        return null;
      }

      const configSetting = await this.configSettingService.findOne({
        where: {
          configId: leaveCategoriesConfiguration.id,
          contextKey: financialYear,
          isActive: true,
        },
      });

      return configSetting?.value || null;
    } catch (error) {
      this.logger.error('Error fetching leave categories config', error);
      return null;
    }
  }

  /**
   * CRON 6: Auto Approve Pending Leaves
   * Runs on 1st of every month at 12:00 AM IST (before payroll generation)
   *
   * Auto-approves all pending leave applications for the previous month
   * This ensures leaves are counted in payroll even if admin forgot to approve
   */
  @Cron(CRON_SCHEDULES.MONTHLY_FIRST_MIDNIGHT_IST)
  async handleAutoApproveLeaves(): Promise<AutoApproveLeavesResult> {
    const cronName = CRON_NAMES.AUTO_APPROVE_LEAVES;
    this.schedulerService.logCronStart(cronName);

    const result: AutoApproveLeavesResult = {
      leavesApproved: 0,
      errors: [],
    };

    try {
      const currentDate = this.schedulerService.getCurrentDateIST();

      // Get previous month's date range
      const { startDate, endDate } = this.getPreviousMonthDateRange(currentDate);

      this.logger.log(
        `[${cronName}] Auto-approving pending leaves from ${startDate} to ${endDate}`,
      );

      // Get all pending leave applications for the previous month
      const pendingLeaves = await this.getPendingLeavesForPeriod(startDate, endDate);

      if (pendingLeaves.length === 0) {
        this.logger.log(`[${cronName}] No pending leaves found for previous month`);
        this.schedulerService.logCronComplete(cronName, result);
        return result;
      }

      this.logger.log(`[${cronName}] Found ${pendingLeaves.length} pending leaves to auto-approve`);

      await this.dataSource.transaction(async (entityManager) => {
        for (const leave of pendingLeaves) {
          try {
            const { query, params } = autoApproveLeaveQuery(
              leave.id,
              SYSTEM_NOTES.AUTO_APPROVED_LEAVE,
            );
            await entityManager.query(query, params);

            result.leavesApproved++;
            this.logger.log(
              `[${cronName}] Auto-approved leave ${leave.id} for user ${leave.userId}`,
            );
          } catch (error) {
            result.errors.push(`Failed to approve leave ${leave.id}: ${error.message}`);
            this.logger.error(`[${cronName}] Failed to approve leave ${leave.id}`, error);
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

  private getPreviousMonthDateRange(currentDate: Date): { startDate: string; endDate: string } {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    // Previous month
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11; // December
      prevYear = year - 1;
    }

    // First day of previous month
    const startDate = new Date(prevYear, prevMonth, 1);

    // Last day of previous month
    const endDate = new Date(year, month, 0);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  private async getPendingLeavesForPeriod(
    startDate: string,
    endDate: string,
  ): Promise<Array<{ id: string; userId: string }>> {
    const { query, params } = getPendingLeavesForPeriodQuery(startDate, endDate);
    return await this.dataSource.query(query, params);
  }

  /**
   * CRON 7: Monthly Leave Accrual
   * Runs on 1st of every month at 12:30 AM IST (after auto-approve cron)
   *
   * Credits monthly leaves based on config. Uses cumulative calculation
   * to ensure no decimals while totaling to annual quota.
   *
   * Formula: toCredit = floor(annualQuota * currentMonth / 12) - alreadyCredited
   *
   * Example for 52 leaves/year:
   * - Month 1: floor(52 * 1/12) = 4
   * - Month 2: floor(52 * 2/12) - 4 = 8 - 4 = 4
   * - Month 3: floor(52 * 3/12) - 8 = 13 - 8 = 5
   * - ...
   * - Month 12: floor(52 * 12/12) - 48 = 52 - 48 = 4
   */
  @Cron(CRON_SCHEDULES.MONTHLY_FIRST_1230AM_IST)
  async handleMonthlyLeaveAccrual(): Promise<MonthlyLeaveAccrualResult> {
    const cronName = CRON_NAMES.MONTHLY_LEAVE_ACCRUAL;
    this.schedulerService.logCronStart(cronName);

    const result: MonthlyLeaveAccrualResult = {
      usersProcessed: 0,
      categoriesProcessed: 0,
      leavesCredited: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const currentDate = this.schedulerService.getCurrentDateIST();
      const financialYear = this.utilityService.getFinancialYear(currentDate);
      const currentMonth = this.getMonthInFinancialYear(currentDate);

      this.logger.log(
        `[${cronName}] Processing for FY: ${financialYear}, Month in FY: ${currentMonth}`,
      );

      const leaveCategoriesConfig = await this.getLeaveCategoriesConfig(financialYear);

      if (!leaveCategoriesConfig) {
        this.logger.warn(`[${cronName}] No leave categories config found for ${financialYear}`);
        this.schedulerService.logCronComplete(cronName, result);
        return result;
      }

      const leaveConfigId = await this.getLeaveConfigSettingId(financialYear);

      const { query: usersQuery, params: usersParams } = getActiveUsersQuery();
      const activeUsers: Array<{ id: string }> = await this.dataSource.query(
        usersQuery,
        usersParams,
      );

      if (activeUsers.length === 0) {
        this.logger.log(`[${cronName}] No active users found`);
        this.schedulerService.logCronComplete(cronName, result);
        return result;
      }

      this.logger.log(`[${cronName}] Processing ${activeUsers.length} active users`);

      const leaveCategories = Object.keys(leaveCategoriesConfig);

      await this.dataSource.transaction(async (entityManager) => {
        for (const category of leaveCategories) {
          const categoryConfig = leaveCategoriesConfig[category]?.actual;

          if (!categoryConfig) {
            this.logger.warn(`[${cronName}] No config found for category: ${category}`);
            continue;
          }

          if (categoryConfig.creditFrequency !== 'monthly') {
            this.logger.log(`[${cronName}] Skipping ${category} - creditFrequency is not monthly`);
            result.skipped++;
            continue;
          }

          const annualQuota = Number(categoryConfig.annualQuota) || 0;

          if (annualQuota <= 0) {
            this.logger.log(`[${cronName}] Skipping ${category} - annualQuota is 0 or invalid`);
            result.skipped++;
            continue;
          }

          const shouldHaveCreditedByNow = Math.floor((annualQuota * currentMonth) / 12);

          this.logger.log(
            `[${cronName}] ${category}: annualQuota=${annualQuota}, month=${currentMonth}, shouldHaveByNow=${shouldHaveCreditedByNow}`,
          );

          result.categoriesProcessed++;

          for (const user of activeUsers) {
            try {
              const credited = await this.creditLeavesForUser(
                user.id,
                category,
                financialYear,
                leaveConfigId,
                shouldHaveCreditedByNow,
                currentMonth,
                entityManager,
                cronName,
              );

              if (credited > 0) {
                result.leavesCredited += credited;
              }
            } catch (error) {
              result.errors.push(`User ${user.id}, ${category}: ${error.message}`);
              this.logger.error(
                `[${cronName}] Error processing ${category} for user ${user.id}`,
                error,
              );
            }
          }
        }

        result.usersProcessed = activeUsers.length;
      });

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private getMonthInFinancialYear(date: Date): number {
    const month = date.getMonth(); // 0-indexed (0 = Jan)
    // FY starts in April (month 3)
    // April = month 1, May = month 2, ..., March = month 12
    if (month >= 3) {
      return month - 2; // April(3) -> 1, May(4) -> 2, etc.
    } else {
      return month + 10; // Jan(0) -> 10, Feb(1) -> 11, Mar(2) -> 12
    }
  }

  private getMonthNameFromFYMonth(fyMonth: number): string {
    const monthNames = [
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
    ];
    return monthNames[fyMonth - 1] || 'Unknown';
  }

  private async getLeaveConfigSettingId(financialYear: string): Promise<string | null> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.LEAVE,
          key: CONFIGURATION_KEYS.LEAVE_CATEGORIES_CONFIG,
        },
      });

      if (!config) return null;

      const configSetting = await this.configSettingService.findOne({
        where: {
          configId: config.id,
          contextKey: financialYear,
          isActive: true,
        },
      });

      return configSetting?.id || null;
    } catch {
      return null;
    }
  }

  private async creditLeavesForUser(
    userId: string,
    leaveCategory: string,
    financialYear: string,
    leaveConfigId: string | null,
    shouldHaveCreditedByNow: number,
    currentMonth: number,
    entityManager: any,
    cronName: string,
  ): Promise<number> {
    const { query: balanceQuery, params: balanceParams } = getUserLeaveBalanceQuery(
      userId,
      leaveCategory,
      financialYear,
    );
    const [existingBalance] = await entityManager.query(balanceQuery, balanceParams);

    const currentlyAllocated = existingBalance ? Number(existingBalance.totalAllocated) || 0 : 0;
    const toCredit = shouldHaveCreditedByNow - currentlyAllocated;

    if (toCredit <= 0) {
      return 0;
    }

    const monthName = this.getMonthNameFromFYMonth(currentMonth);
    const note = `[${monthName}] +${toCredit} leaves credited (cumulative: ${shouldHaveCreditedByNow})`;

    if (existingBalance) {
      const { query: updateQuery, params: updateParams } = updateLeaveBalanceQuery(
        existingBalance.id,
        shouldHaveCreditedByNow,
        note,
      );
      await entityManager.query(updateQuery, updateParams);
    } else {
      const { query: createQuery, params: createParams } = createLeaveBalanceQuery(
        userId,
        leaveConfigId || '',
        leaveCategory,
        financialYear,
        shouldHaveCreditedByNow,
        'monthly_accrual',
        note,
      );
      await entityManager.query(createQuery, createParams);
    }

    this.logger.log(
      `[${cronName}] Credited ${toCredit} ${leaveCategory} to user ${userId} (total: ${shouldHaveCreditedByNow})`,
    );

    return toCredit;
  }
}
