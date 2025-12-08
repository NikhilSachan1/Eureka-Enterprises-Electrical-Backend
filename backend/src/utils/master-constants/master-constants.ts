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
  FUEL_EXPENSE_DATE_VALIDATION: 'fuel_expense_date_validation',
};

export const CONFIGURATION_MODULES = {
  PERMISSION: 'permission',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  EXPENSE: 'expense',
  FUEL_EXPENSE: 'fuel_expense',
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

export const USER_RESPONSE_FIELDS = ['id', 'firstName', 'lastName', 'email', 'employeeId'] as const;

export const getUserSelectFields = (alias: string, prefix?: string): string => {
  const fields = USER_RESPONSE_FIELDS;
  if (prefix) {
    return fields
      .map(
        (field) =>
          `${alias}."${field}" as "${prefix}${field.charAt(0).toUpperCase() + field.slice(1)}"`,
      )
      .join(', ');
  }
  return fields.map((field) => `${alias}."${field}"`).join(', ');
};

export const getUserJsonBuildObject = (alias: string): string => {
  const fields = USER_RESPONSE_FIELDS;
  const jsonFields = fields.map((field) => `'${field}', ${alias}."${field}"`).join(', ');
  return `json_build_object(${jsonFields})`;
};
