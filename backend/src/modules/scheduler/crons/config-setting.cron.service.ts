import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import {
  ConfigSettingActivationResult,
  PendingConfigSetting,
  ExpiredConfigSetting,
  CurrentActiveSetting,
  ConfigActivationLogEntry,
} from '../types/config-setting.types';
import {
  getPendingActivationSettingsQuery,
  getExpiredActiveSettingsQuery,
  getCurrentActiveSettingQuery,
  activateConfigSettingQuery,
  deactivateConfigSettingQuery,
} from '../queries/config-setting.queries';

@Injectable()
export class ConfigSettingCronService {
  private readonly logger = new Logger(ConfigSettingCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 19: Config Setting Activation/Deactivation
   *
   * Runs daily at midnight IST to manage config setting transitions.
   *
   * Scenarios Handled:
   * 1. ACTIVATION: Settings with effectiveFrom <= today that are inactive
   *    - Activates the pending setting
   *    - Deactivates/supersedes the current active setting for same config+context
   *    - Sets effectiveTo on the superseded setting
   *
   * 2. DEACTIVATION: Settings with effectiveTo < today that are still active
   *    - Deactivates expired settings
   *
   * 3. CONTEXT-AWARE: Settings are grouped by configId + contextKey
   *    - Each config+context combination has at most ONE active setting
   *    - Leave configs use contextKey for financial year (e.g., "2024-25")
   *
   * 4. MULTIPLE PENDING: If same config+context has multiple pending settings
   *    - Processes them in order of effectiveFrom (oldest first)
   *    - Each activation supersedes the previous
   *
   * Validations:
   * - Skips deleted config settings (deletedAt IS NOT NULL)
   * - Skips settings for deleted configurations
   * - Ensures only ONE active setting per configId + contextKey
   * - Logs all changes for audit trail
   *
   * Use Cases:
   * - Leave configurations transitioning between financial years
   * - Scheduled policy changes (attendance, expense limits, etc.)
   * - Seasonal configuration updates
   */
  @Cron(CRON_SCHEDULES.DAILY_MIDNIGHT_IST)
  async handleConfigSettingActivation(): Promise<ConfigSettingActivationResult> {
    const cronName = CRON_NAMES.CONFIG_SETTING_ACTIVATION;
    this.schedulerService.logCronStart(cronName);

    const result: ConfigSettingActivationResult = {
      settingsActivated: 0,
      settingsDeactivated: 0,
      previousSettingsSuperseded: 0,
      configsAffected: [],
      errors: [],
    };

    const activationLog: ConfigActivationLogEntry[] = [];

    try {
      // Deactivate expired settings first
      const deactivationResult = await this.deactivateExpiredSettings(cronName, activationLog);
      result.settingsDeactivated = deactivationResult.count;
      result.errors.push(...deactivationResult.errors);

      // Activate pending settings
      const activationResult = await this.activatePendingSettings(cronName, activationLog);
      result.settingsActivated = activationResult.activated;
      result.previousSettingsSuperseded = activationResult.superseded;
      result.configsAffected = activationResult.configsAffected;
      result.errors.push(...activationResult.errors);

      this.logActivationSummary(cronName, activationLog);

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private async deactivateExpiredSettings(
    cronName: string,
    activationLog: ConfigActivationLogEntry[],
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { query, params } = getExpiredActiveSettingsQuery();
      const expiredSettings: ExpiredConfigSetting[] = await this.dataSource.query(query, params);

      if (expiredSettings.length === 0) {
        this.logger.log(`[${cronName}] No expired config settings to deactivate`);
        return { count: 0, errors: [] };
      }

      this.logger.log(`[${cronName}] Found ${expiredSettings.length} expired config settings`);

      for (const setting of expiredSettings) {
        try {
          const { query: deactivateQuery, params: deactivateParams } = deactivateConfigSettingQuery(
            setting.id,
          );
          await this.dataSource.query(deactivateQuery, deactivateParams);

          activationLog.push({
            settingId: setting.id,
            configId: setting.configId,
            configKey: setting.configKey,
            configModule: setting.configModule,
            contextKey: setting.contextKey,
            action: 'DEACTIVATED',
            effectiveFrom: setting.effectiveFrom,
            effectiveTo: setting.effectiveTo,
          });

          const contextInfo = setting.contextKey ? ` [${setting.contextKey}]` : '';
          this.logger.debug(
            `[${cronName}] Deactivated expired setting for ${setting.configModule}.${setting.configKey}${contextInfo}`,
          );
          count++;
        } catch (error) {
          const errorMsg = `Failed to deactivate setting ${setting.id}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[${cronName}] ${errorMsg}`);
        }
      }

      return { count, errors };
    } catch (error) {
      errors.push(`Deactivation query failed: ${error.message}`);
      return { count: 0, errors };
    }
  }

  private async activatePendingSettings(
    cronName: string,
    activationLog: ConfigActivationLogEntry[],
  ): Promise<{
    activated: number;
    superseded: number;
    configsAffected: string[];
    errors: string[];
  }> {
    const errors: string[] = [];
    let activated = 0;
    let superseded = 0;
    const configsAffected: Set<string> = new Set();

    try {
      const { query, params } = getPendingActivationSettingsQuery();
      const pendingSettings: PendingConfigSetting[] = await this.dataSource.query(query, params);

      if (pendingSettings.length === 0) {
        this.logger.log(`[${cronName}] No pending config settings to activate`);
        return { activated: 0, superseded: 0, configsAffected: [], errors: [] };
      }

      this.logger.log(`[${cronName}] Found ${pendingSettings.length} pending config settings`);

      // Group by configId + contextKey to handle multiple pending settings per config
      const settingsByConfigContext = this.groupSettingsByConfigContext(pendingSettings);

      for (const [, settings] of settingsByConfigContext.entries()) {
        for (const setting of settings) {
          try {
            const { query: activeQuery, params: activeParams } = getCurrentActiveSettingQuery(
              setting.configId,
              setting.contextKey,
            );
            const [currentActive]: CurrentActiveSetting[] = await this.dataSource.query(
              activeQuery,
              activeParams,
            );

            if (currentActive && currentActive.id !== setting.id) {
              const effectiveTo = new Date(setting.effectiveFrom);
              effectiveTo.setDate(effectiveTo.getDate() - 1);

              const { query: deactivateQuery, params: deactivateParams } =
                deactivateConfigSettingQuery(currentActive.id, effectiveTo);
              await this.dataSource.query(deactivateQuery, deactivateParams);

              activationLog.push({
                settingId: currentActive.id,
                configId: setting.configId,
                configKey: setting.configKey,
                configModule: setting.configModule,
                contextKey: setting.contextKey,
                action: 'SUPERSEDED',
                effectiveFrom: currentActive.effectiveFrom,
                effectiveTo: effectiveTo,
              });

              const contextInfo = setting.contextKey ? ` [${setting.contextKey}]` : '';
              this.logger.debug(
                `[${cronName}] Superseded setting for ${setting.configModule}.${setting.configKey}${contextInfo}`,
              );
              superseded++;
            }

            const { query: activateQuery, params: activateParams } = activateConfigSettingQuery(
              setting.id,
            );
            await this.dataSource.query(activateQuery, activateParams);

            activationLog.push({
              settingId: setting.id,
              configId: setting.configId,
              configKey: setting.configKey,
              configModule: setting.configModule,
              contextKey: setting.contextKey,
              action: 'ACTIVATED',
              effectiveFrom: setting.effectiveFrom,
              effectiveTo: setting.effectiveTo,
            });

            const contextInfo = setting.contextKey ? ` [${setting.contextKey}]` : '';
            this.logger.log(
              `[${cronName}] ✅ Activated setting for ${setting.configModule}.${setting.configKey}${contextInfo}`,
            );

            activated++;
            configsAffected.add(`${setting.configModule}.${setting.configKey}`);
          } catch (error) {
            const contextInfo = setting.contextKey ? ` [${setting.contextKey}]` : '';
            const errorMsg = `Failed to activate setting ${setting.id} for ${setting.configModule}.${setting.configKey}${contextInfo}: ${error.message}`;
            errors.push(errorMsg);
            this.logger.error(`[${cronName}] ${errorMsg}`);
          }
        }
      }

      return {
        activated,
        superseded,
        configsAffected: Array.from(configsAffected),
        errors,
      };
    } catch (error) {
      errors.push(`Activation query failed: ${error.message}`);
      return { activated: 0, superseded: 0, configsAffected: [], errors };
    }
  }

  private groupSettingsByConfigContext(
    settings: PendingConfigSetting[],
  ): Map<string, PendingConfigSetting[]> {
    const grouped = new Map<string, PendingConfigSetting[]>();

    for (const setting of settings) {
      const key = `${setting.configId}::${setting.contextKey || 'NULL'}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(setting);
      } else {
        grouped.set(key, [setting]);
      }
    }

    return grouped;
  }

  private logActivationSummary(cronName: string, activationLog: ConfigActivationLogEntry[]): void {
    if (activationLog.length === 0) {
      this.logger.log(`[${cronName}] No config setting changes today`);
      return;
    }

    const activated = activationLog.filter((log) => log.action === 'ACTIVATED').length;
    const deactivated = activationLog.filter((log) => log.action === 'DEACTIVATED').length;
    const superseded = activationLog.filter((log) => log.action === 'SUPERSEDED').length;

    this.logger.log(
      `[${cronName}] Summary: ${activated} activated, ${superseded} superseded, ${deactivated} deactivated`,
    );

    for (const log of activationLog) {
      const emoji = log.action === 'ACTIVATED' ? '🟢' : log.action === 'SUPERSEDED' ? '🔄' : '🔴';
      const contextInfo = log.contextKey ? ` [${log.contextKey}]` : '';
      this.logger.debug(
        `[${cronName}] ${emoji} ${log.action}: ${log.configModule}.${log.configKey}${contextInfo}`,
      );
    }
  }
}
