import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { LeaveBalancesService } from './leave-balances.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { CreateLeaveBalanceDto } from './types/leave-balances.types';
import {
  LeaveCreditResult,
  CalendarSettings,
  LeaveCategoryConfig,
} from './types/leave-credit.types';
import {
  LEAVE_CREDIT_ERRORS,
  LEAVE_CREDIT_LOG_MESSAGES,
  NOTE_TEMPLATES,
} from './constants/leave-credit.constants';

@Injectable()
export class LeaveCreditService {
  private readonly logger = new Logger(LeaveCreditService.name);

  constructor(
    private readonly leaveBalancesService: LeaveBalancesService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
  ) {}

  async creditLeavesForNewEmployee(
    userId: string,
    dateOfJoining: Date,
    createdBy: string,
    entityManager?: EntityManager,
  ): Promise<LeaveCreditResult> {
    const result: LeaveCreditResult = {
      userId,
      financialYear: '',
      dateOfJoining,
      monthsRemaining: 0,
      firstMonthFraction: 0,
      categoriesCredited: [],
      errors: [],
    };

    try {
      const financialYear = this.utilityService.getFinancialYear(dateOfJoining);
      result.financialYear = financialYear;

      const calendarSettings = await this.getCalendarSettings();
      if (!calendarSettings) {
        result.errors.push(LEAVE_CREDIT_ERRORS.CALENDAR_SETTINGS_NOT_FOUND);
        return result;
      }

      const leaveCategoriesConfig = await this.getLeaveCategoriesConfig(financialYear);
      if (!leaveCategoriesConfig) {
        result.errors.push(
          LEAVE_CREDIT_ERRORS.LEAVE_CATEGORIES_CONFIG_NOT_FOUND + ` for FY ${financialYear}`,
        );
        return result;
      }

      const leaveConfigId = await this.getLeaveConfigSettingId(financialYear);
      if (!leaveConfigId) {
        result.errors.push(LEAVE_CREDIT_ERRORS.LEAVE_CONFIG_SETTING_ID_NOT_FOUND);
        return result;
      }

      const { monthsRemaining, firstMonthFraction } = this.calculateEffectiveMonths(
        dateOfJoining,
        calendarSettings,
      );
      result.monthsRemaining = monthsRemaining;
      result.firstMonthFraction = firstMonthFraction;

      const effectiveMonths = monthsRemaining + firstMonthFraction;

      this.logger.log(
        LEAVE_CREDIT_LOG_MESSAGES.USER_JOINED_ON_DATE.replace('{userId}', userId).replace(
          '{dateOfJoining}',
          dateOfJoining.toISOString().split('T')[0],
        ),
      );

      const leaveCategories = Object.keys(leaveCategoriesConfig);

      for (const category of leaveCategories) {
        try {
          const categoryConfig = leaveCategoriesConfig[category]?.actual;

          if (!categoryConfig) {
            this.logger.warn(`[LeaveCreditService] No config found for category: ${category}`);
            continue;
          }

          const annualQuota = Number(categoryConfig.annualQuota) || 0;
          const creditFrequency = categoryConfig.creditFrequency || 'monthly';

          if (annualQuota <= 0) {
            this.logger.log(
              LEAVE_CREDIT_LOG_MESSAGES.SKIPPING_CATEGORY_WITH_ZERO_QUOTA.replace(
                '{category}',
                category,
              )
                .replace('{annualQuota}', annualQuota.toString())
                .replace('{userId}', userId),
            );
            continue;
          }

          let allocation: number;
          let note: string;
          const joiningDateStr = dateOfJoining.toISOString().split('T')[0];

          if (creditFrequency === 'monthly') {
            allocation = (annualQuota * firstMonthFraction) / 12;
            note = NOTE_TEMPLATES.JOINING_MONTH_SHARE.replace('{joiningDateStr}', joiningDateStr)
              .replace('{firstMonthFraction}', firstMonthFraction.toString())
              .replace('{monthlyQuota}', (annualQuota / 12).toFixed(1));

            this.logger.log(
              LEAVE_CREDIT_LOG_MESSAGES.CREDITING_LEAVES_TO_USER.replace('{category}', category)
                .replace('{allocation}', allocation.toString())
                .replace('{userId}', userId)
                .replace('{financialYear}', financialYear),
            );
          } else {
            allocation = (annualQuota * effectiveMonths) / 12;
            note = NOTE_TEMPLATES.PRO_RATA.replace('{joiningDateStr}', joiningDateStr)
              .replace('{effectiveMonths}', effectiveMonths.toString())
              .replace('{annualQuota}', annualQuota.toString());

            this.logger.log(
              LEAVE_CREDIT_LOG_MESSAGES.CREDITING_LEAVES_TO_USER.replace('{category}', category)
                .replace('{allocation}', allocation.toString())
                .replace('{userId}', userId)
                .replace('{financialYear}', financialYear),
            );
          }

          if (!calendarSettings.allowFractional) {
            allocation = Math.floor(allocation);
          } else {
            allocation = Math.round(allocation * 10) / 10;
          }

          if (allocation <= 0) {
            this.logger.log(
              LEAVE_CREDIT_LOG_MESSAGES.SKIPPING_CATEGORY_WITH_ZERO_QUOTA.replace(
                '{category}',
                category,
              ),
            );
            continue;
          }

          const createDto: CreateLeaveBalanceDto = {
            userId,
            leaveConfigId: leaveConfigId || '',
            leaveCategory: category,
            financialYear,
            totalAllocated: allocation.toString(),
            creditSource: 'joining_credit',
            notes: note,
            createdBy,
          };

          await this.leaveBalancesService.create(createDto, entityManager);

          result.categoriesCredited.push({
            category,
            allocated: allocation,
            note,
          });

          this.logger.log(
            LEAVE_CREDIT_LOG_MESSAGES.CREDITING_LEAVES_TO_USER.replace('{category}', category)
              .replace('{allocation}', allocation.toString())
              .replace('{userId}', userId)
              .replace('{financialYear}', financialYear),
          );
        } catch (error) {
          const errorMsg = LEAVE_CREDIT_LOG_MESSAGES.FAILED_TO_CREDIT_LEAVES.replace(
            '{category}',
            category,
          )
            .replace('{error}', error.message)
            .replace('{userId}', userId);
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(
        LEAVE_CREDIT_LOG_MESSAGES.FAILED_TO_CREDIT_LEAVES.replace('{error}', error.message).replace(
          '{userId}',
          userId,
        ),
      );
      this.logger.error(
        LEAVE_CREDIT_LOG_MESSAGES.FAILED_TO_CREDIT_LEAVES.replace('{error}', error.message).replace(
          '{userId}',
          userId,
        ),
      );
      return result;
    }
  }

  private calculateEffectiveMonths(
    dateOfJoining: Date,
    calendarSettings: CalendarSettings,
  ): { monthsRemaining: number; firstMonthFraction: number } {
    const joiningMonth = dateOfJoining.getMonth() + 1; // 1-12
    const joiningDay = dateOfJoining.getDate();

    const fyEndMonth = calendarSettings.endMonth;

    let monthsRemaining: number;
    if (joiningMonth <= fyEndMonth) {
      monthsRemaining = fyEndMonth - joiningMonth;
    } else {
      monthsRemaining = 12 - joiningMonth + fyEndMonth;
    }

    let firstMonthFraction: number;
    const cutoffDay = calendarSettings.joiningCutoffDay;
    const midMonthPolicy = calendarSettings.midMonthJoinPolicy;

    if (joiningDay <= cutoffDay) {
      firstMonthFraction = midMonthPolicy.beforeCutoff === 'full' ? 1 : 0;
    } else {
      firstMonthFraction = midMonthPolicy.afterCutoff === 'half' ? 0.5 : 0;
    }

    return { monthsRemaining, firstMonthFraction };
  }

  private async getCalendarSettings(): Promise<CalendarSettings | null> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.LEAVE,
          key: CONFIGURATION_KEYS.CALENDAR_SETTINGS,
        },
      });

      if (!config) return null;

      const configSetting = await this.configSettingService.findOne({
        where: {
          configId: config.id,
          isActive: true,
        },
      });

      return configSetting?.value || null;
    } catch {
      return null;
    }
  }

  private async getLeaveCategoriesConfig(
    financialYear: string,
  ): Promise<Record<string, { actual: LeaveCategoryConfig }> | null> {
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

      return configSetting?.value || null;
    } catch {
      return null;
    }
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
}
