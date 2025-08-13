export const CONFIGURATION_KEYS = {
  //ATTENDANCE
  MODULES: 'modules',
  SHIFT_CONFIGS: 'shift_configs',
  REGULARIZATION_CONFIGS: 'regularization_configs',
  //LEAVE
  LEAVE_TYPES: 'leave_types',
  LEAVE_CATEGORIES: 'leave_categories',
  LEAVE_CATEGORIES_CONFIG: 'leave_categories_config',
  HOLIDAY_CALENDAR: 'holiday_calendar',
  CALENDAR_SETTINGS: 'calendar_settings',
  //EXPENSE
  EXPENSE_CATEGORIES: 'expense_categories',
  PAYMENT_MODES: 'payment_modes',
  TRANSACTION_TYPES: 'transaction_types',
  EXPENSE_DATE_VALIDATION: 'expense_date_validation',
};

export const CONFIGURATION_MODULES = {
  PERMISSION: 'permission',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  EXPENSE: 'expense',
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
