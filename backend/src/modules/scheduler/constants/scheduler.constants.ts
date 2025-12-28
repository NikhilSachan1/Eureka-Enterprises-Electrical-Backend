/**
 * Cron Schedules
 * All times are in UTC - Server runs in UTC
 * IST = UTC + 5:30
 */
export const CRON_SCHEDULES = {
  // 12:00 AM IST = 6:30 PM UTC (previous day)
  DAILY_MIDNIGHT_IST: '30 18 * * *',

  // 11:59 PM IST = 6:29 PM UTC
  DAILY_END_OF_DAY_IST: '29 18 * * *',

  // Every 10 minutes
  EVERY_10_MINUTES: '*/10 * * * *',

  // 9:00 AM IST = 3:30 AM UTC
  DAILY_9AM_IST: '30 3 * * *',

  // 1st of every month at 12:00 AM IST
  MONTHLY_FIRST_MIDNIGHT_IST: '30 18 1 * *',

  // March 15 at 9:00 AM IST (for FY reminders)
  MARCH_15_9AM_IST: '30 3 15 3 *',

  // April 1 at 12:00 AM IST (FY start)
  APRIL_1_MIDNIGHT_IST: '30 18 1 4 *',
};

export const CRON_NAMES = {
  // Attendance
  DAILY_ATTENDANCE_ENTRY: 'DailyAttendanceEntry',
  END_OF_DAY_ATTENDANCE: 'EndOfDayAttendance',

  // Leave
  FY_LEAVE_CONFIG_REMINDER: 'FYLeaveConfigReminder',
  FY_LEAVE_CONFIG_AUTO_COPY: 'FYLeaveConfigAutoCopy',
  LEAVE_CARRY_FORWARD: 'LeaveCarryForward',
  AUTO_APPROVE_LEAVES: 'AutoApproveLeaves',
  MONTHLY_LEAVE_ACCRUAL: 'MonthlyLeaveAccrual',

  // Payroll
  MONTHLY_PAYROLL_GENERATION: 'MonthlyPayrollGeneration',

  // Announcements
  EXPIRE_ANNOUNCEMENTS: 'ExpireAnnouncements',
  PUBLISH_ANNOUNCEMENTS: 'PublishAnnouncements',

  // Alerts
  VEHICLE_DOCUMENT_EXPIRY_ALERTS: 'VehicleDocumentExpiryAlerts',
  VEHICLE_SERVICE_DUE_REMINDERS: 'VehicleServiceDueReminders',
  ASSET_CALIBRATION_EXPIRY_ALERTS: 'AssetCalibrationExpiryAlerts',
  ASSET_WARRANTY_EXPIRY_ALERTS: 'AssetWarrantyExpiryAlerts',
  CARD_EXPIRY_ALERTS: 'CardExpiryAlerts',
  PENDING_EXPENSE_REMINDERS: 'PendingExpenseReminders',

  // User
  BIRTHDAY_ANNIVERSARY_WISHES: 'BirthdayAnniversaryWishes',
  SALARY_STRUCTURE_ACTIVATION: 'SalaryStructureActivation',

  // Config
  CONFIG_SETTING_ACTIVATION: 'ConfigSettingActivation',
};

export const SYSTEM_NOTES = {
  AUTO_CREATED_BY_SYSTEM_CRON: 'Auto-created by system cron',
  HOLIDAY: 'Holiday - Auto-created by system cron',
  LEAVE: 'On leave ({leaveCategory}) - Auto-created by system cron',
};
