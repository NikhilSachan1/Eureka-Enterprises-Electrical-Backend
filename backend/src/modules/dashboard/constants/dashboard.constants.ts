export enum DashboardSection {
  OVERVIEW = 'overview',
  BIRTHDAYS = 'birthdays',
  ANNIVERSARIES = 'anniversaries',
  FESTIVALS = 'festivals',
  ATTENDANCE = 'attendance',
  LEAVE = 'leave',
  PAYROLL = 'payroll',
  EXPENSES = 'expenses',
  ALERTS = 'alerts',
  APPROVALS = 'approvals',
  EMPLOYEES = 'employees',
  TEAM = 'team',
}

export enum DashboardPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum AlertType {
  CARD_EXPIRY = 'cardExpiry',
  VEHICLE_DOC_EXPIRY = 'vehicleDocExpiry',
  VEHICLE_SERVICE_DUE = 'vehicleServiceDue',
  ASSET_CALIBRATION = 'assetCalibration',
  ASSET_WARRANTY = 'assetWarranty',
  MISSING_CONFIG = 'missingConfig',
}

export const DASHBOARD_CONSTANTS = {
  DEFAULT_TREND_DAYS: 30,
  DEFAULT_UPCOMING_DAYS: 14,
  ALERT_CRITICAL_DAYS: 0, // Expired or overdue
  ALERT_WARNING_DAYS: 7, // Expiring/due within 7 days
  ALERT_INFO_DAYS: 30, // Expiring/due within 30 days
  TOP_SPENDERS_LIMIT: 5,
  AGING_THRESHOLDS: {
    DAYS_1: 1,
    DAYS_2_3: 3,
    DAYS_4_PLUS: 4,
  },
};

export const DASHBOARD_ERRORS = {
  INVALID_SECTION: 'Invalid dashboard section: {section}',
  INVALID_PERIOD: 'Invalid period. Valid options: today, week, month, quarter, year, custom',
  CUSTOM_DATES_REQUIRED: 'startDate and endDate are required for custom period',
  SECTION_NOT_ACCESSIBLE: 'You do not have access to this dashboard section',
};

// Additional sections that can be added in future
export const FUTURE_SECTIONS = {
  PERFORMANCE: 'performance', // Employee performance metrics
  RECRUITMENT: 'recruitment', // Hiring pipeline
  TRAINING: 'training', // Training completion
  COMPLIANCE: 'compliance', // Policy compliance
  BUDGET: 'budget', // Budget vs actual
  TURNOVER: 'turnover', // Attrition metrics
  OVERTIME: 'overtime', // Overtime tracking
  SHIFT_COVERAGE: 'shiftCoverage', // Shift scheduling
  GRIEVANCES: 'grievances', // Employee grievances
  SURVEYS: 'surveys', // Employee satisfaction
};
