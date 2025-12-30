/**
 * Types for CRON 19: Config Setting Activation/Deactivation
 *
 * Automatically manages config setting transitions based on effective dates.
 */

export interface ConfigSettingActivationResult {
  settingsActivated: number;
  settingsDeactivated: number;
  previousSettingsSuperseded: number;
  configsAffected: string[];
  errors: string[];
}

export interface PendingConfigSetting {
  id: string;
  configId: string;
  contextKey: string | null;
  value: any;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  // Configuration info
  configKey: string;
  configModule: string;
  configLabel: string;
}

export interface ExpiredConfigSetting {
  id: string;
  configId: string;
  contextKey: string | null;
  effectiveFrom: Date;
  effectiveTo: Date;
  isActive: boolean;
  // Configuration info
  configKey: string;
  configModule: string;
  configLabel: string;
}

export interface CurrentActiveSetting {
  id: string;
  configId: string;
  contextKey: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  isActive: boolean;
}

export interface ConfigActivationLogEntry {
  settingId: string;
  configId: string;
  configKey: string;
  configModule: string;
  contextKey: string | null;
  action: 'ACTIVATED' | 'DEACTIVATED' | 'SUPERSEDED';
  effectiveFrom: Date | null;
  effectiveTo?: Date | null;
}
