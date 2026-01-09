export const CONFIGURATION_KEYS = {
  // SYSTEM / NOTIFICATIONS
  NOTIFICATION_EMAILS: 'notification_emails',
  //ATTENDANCE
  MODULES: 'modules',
  SHIFT_CONFIGS: 'shift_configs',
  REGULARIZATION_CONFIGS: 'regularization_configs',
  ATTENDANCE_APPROVAL_REMINDER_THRESHOLD_DAYS: 'attendance_approval_reminder_threshold_days',
  //LEAVE
  LEAVE_TYPES: 'leave_types',
  LEAVE_CATEGORIES: 'leave_categories',
  LEAVE_CATEGORIES_CONFIG: 'leave_categories_config',
  HOLIDAY_CALENDAR: 'holiday_calendar',
  CALENDAR_SETTINGS: 'calendar_settings',
  LEAVE_APPROVAL_REMINDER_THRESHOLD_DAYS: 'leave_approval_reminder_threshold_days',
  //EXPENSE
  EXPENSE_CATEGORIES: 'expense_categories',
  PAYMENT_MODES: 'payment_modes',
  TRANSACTION_TYPES: 'transaction_types',
  EXPENSE_DATE_VALIDATION: 'expense_date_validation',
  FUEL_EXPENSE_DATE_VALIDATION: 'fuel_expense_date_validation',
  EXPENSE_URGENT_THRESHOLD_DAYS: 'expense_urgent_threshold_days',
  //EMPLOYEE
  GENDERS: 'genders',
  BLOOD_GROUPS: 'blood_groups',
  EMPLOYEE_TYPES: 'employee_types',
  DESIGNATIONS: 'designations',
  DEGREES: 'degrees',
  BRANCHES: 'branches',
  DOCUMENT_TYPES: 'document_types',
  //ANNOUNCEMENTS
  ANNOUNCEMENT_TARGET_TYPES: 'announcement_target_types',
  ANNOUNCEMENT_STATUSES: 'announcement_statuses',
  //ASSETS
  ASSET_CATEGORIES: 'asset_categories',
  ASSET_TYPES: 'asset_types',
  ASSET_STATUSES: 'asset_statuses',
  ASSET_FILE_TYPES: 'asset_file_types',
  CALIBRATION_SOURCES: 'calibration_sources',
  CALIBRATION_FREQUENCIES: 'calibration_frequencies',
  ASSET_EXPIRING_SOON_DAYS: 'asset_expiring_soon_days',
  WARRANTY_STATUSES: 'warranty_statuses',
  CALIBRATION_STATUSES: 'calibration_statuses',
  ASSET_EVENT_TYPES: 'asset_event_types',
  //VEHICLES
  VEHICLE_FUEL_TYPES: 'vehicle_fuel_types',
  VEHICLE_STATUSES: 'vehicle_statuses',
  VEHICLE_FILE_TYPES: 'vehicle_file_types',
  VEHICLE_EVENT_TYPES: 'vehicle_event_types',
  VEHICLE_EXPIRING_SOON_DAYS: 'vehicle_expiring_soon_days',
  // VEHICLE SERVICES
  VEHICLE_SERVICE_TYPES: 'vehicle_service_types',
  VEHICLE_SERVICE_STATUSES: 'vehicle_service_statuses',
  VEHICLE_SERVICE_FILE_TYPES: 'vehicle_service_file_types',
  VEHICLE_SERVICE_INTERVAL_KM: 'vehicle_service_interval_km',
  VEHICLE_SERVICE_WARNING_KM: 'vehicle_service_warning_km',
  // VEHICLE DOCUMENT & SERVICE DUE STATUSES
  VEHICLE_DOCUMENT_STATUSES: 'vehicle_document_statuses',
  VEHICLE_SERVICE_DUE_STATUSES: 'vehicle_service_due_statuses',
  // SALARY
  SALARY_INCREMENT_TYPES: 'salary_increment_types',
  SALARY_COMPONENTS: 'salary_components',
  ESIC_GROSS_LIMIT: 'esic_gross_limit',
  PF_PERCENTAGE: 'pf_percentage',
  PROFESSIONAL_TAX_SLABS: 'professional_tax_slabs',
  // BONUS
  BONUS_TYPES: 'bonus_types',
  BONUS_STATUSES: 'bonus_statuses',
  // PAYROLL
  PAYROLL_STATUSES: 'payroll_statuses',
  PAYROLL_GENERATION_DAY: 'payroll_generation_day',
  PAYROLL_WORKING_DAYS_CALCULATION: 'payroll_working_days_calculation',
  HOLIDAY_WORK_COMPENSATION: 'holiday_work_compensation',
  // CARD
  CARD_TYPES: 'card_types',
  CARD_STATUSES: 'card_statuses',
  CARD_EXPIRY_WARNING_DAYS: 'card_expiry_warning_days',
  CARD_ACTION_TYPES: 'card_action_types',
  // FNF (Full & Final Settlement)
  FNF_SETTINGS: 'fnf_settings',
  FNF_EXIT_REASONS: 'fnf_exit_reasons',
  FNF_STATUSES: 'fnf_statuses',
  FNF_CLEARANCE_STATUSES: 'fnf_clearance_statuses',
};

export const CONFIGURATION_MODULES = {
  SYSTEM: 'system',
  PERMISSION: 'permission',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  EXPENSE: 'expense',
  FUEL_EXPENSE: 'fuel_expense',
  EMPLOYEE: 'employee',
  ANNOUNCEMENTS: 'announcement',
  ASSET: 'asset',
  VEHICLE: 'vehicle',
  SALARY: 'salary',
  BONUS: 'bonus',
  PAYROLL: 'payroll',
  CARD: 'card',
  FNF: 'fnf',
};

export enum LeaveCycleType {
  FINANCIAL_YEAR = 'financial_year',
  CALENDAR_YEAR = 'calendar_year',
}

export enum EntrySourceType {
  WEB = 'web',
  APP = 'app',
  BIOMETRIC = 'biometric',
  SYSTEM = 'system',
}

export const USER_RESPONSE_FIELDS = ['id', 'firstName', 'lastName', 'email', 'employeeId'] as const;

export const COMPANY_DETAILS = {
  NAME: 'Eureka Enterprises Pvt Ltd',
  LOGO_URL: 'https://5.imimg.com/data5/AY/VX/BQ/SELLER-107173792/vvv-120x120.jpeg',
  EMAIL_HR: 'hr@eurekaenterprises.com',
  PHONE: '+91 510 123 4567',
  ADDRESS: {
    CITY: 'Jhansi',
    STATE: 'Uttar Pradesh',
    PINCODE: '284001',
    COUNTRY: 'India',
  },
  FULL_ADDRESS: 'Jhansi, Uttar Pradesh 284001 India',
};
