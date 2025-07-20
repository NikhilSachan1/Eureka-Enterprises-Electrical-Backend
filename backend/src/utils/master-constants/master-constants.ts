export const CONFIGURATION_KEYS = {
  MODULES: 'modules',
  SHIFT_CONFIGS: 'shift_configs',
  REGULARIZATION_CONFIGS: 'regularization_configs',
  LEAVE_TYPES: 'leave_types',
  LEAVE_CATEGORIES: 'leave_categories',
  LEAVE_CATEGORIES_CONFIG: 'leave_categories_config',
  HOLIDAY_CALENDAR: 'holiday_calendar',
  CALENDAR_SETTINGS: 'calendar_settings',
};

export const CONFIGURATION_MODULES = {
  PERMISSION: 'permission',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
};

export enum LeaveCycleType {
  FINANCIAL_YEAR = 'financial_year',
  CALENDAR_YEAR = 'calendar_year',
}

export enum EntrySourceType {
  WEB = 'web',
  APP = 'app',
  BIOMETRIC = 'biometric',
}
