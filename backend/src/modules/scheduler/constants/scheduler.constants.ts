// Import SYSTEM_USER_ID from user constants for consistency
// Re-exported here for convenience in scheduler module
import { SYSTEM_USER_ID } from '../../users/constants/user.constants';

/**
 * Cron Schedules
 * All times are in UTC - Server runs in UTC
 * IST = UTC + 5:30
 *
 * IMPORTANT: Crons are staggered to prevent resource contention
 * and ensure proper sequencing where dependencies exist.
 */
export const CRON_SCHEDULES = {
  // ============================================
  // MIDNIGHT GROUP (12:00 AM IST) - Orchestrated
  // ============================================
  // Single orchestrator runs these in sequence:
  // 1. Config Setting Activation
  // 2. Salary Structure Activation
  // 3. Daily Attendance Entry
  DAILY_MIDNIGHT_ORCHESTRATOR: '30 18 * * *', // 12:00 AM IST

  // Individual schedules (disabled - controlled by orchestrator)
  // Keeping for reference and manual trigger capability
  DAILY_MIDNIGHT_IST: '30 18 * * *',

  // ============================================
  // END OF DAY
  // ============================================
  // 11:59 PM IST = 6:29 PM UTC
  DAILY_END_OF_DAY_IST: '29 18 * * *',

  // 9:00 PM IST = 3:30 PM UTC (typical shift end + buffer)
  DAILY_SHIFT_END_IST: '30 15 * * *',

  // ============================================
  // MORNING ALERTS (9:00 AM IST) - Staggered
  // ============================================
  // Staggered by 2 minutes to prevent resource contention
  // 9:00 AM IST = Card Expiry
  DAILY_9AM_CARD_ALERTS: '30 3 * * *',
  // 9:02 AM IST = Asset Calibration
  DAILY_9AM_ASSET_CALIBRATION: '32 3 * * *',
  // 9:04 AM IST = Asset Warranty
  DAILY_9AM_ASSET_WARRANTY: '34 3 * * *',
  // 9:06 AM IST = Vehicle Documents
  DAILY_9AM_VEHICLE_DOCS: '36 3 * * *',
  // 9:08 AM IST = Vehicle Service
  DAILY_9AM_VEHICLE_SERVICE: '38 3 * * *',
  // 9:10 AM IST = Expense Reminders
  DAILY_9AM_EXPENSE_REMINDERS: '40 3 * * *',
  // 9:12 AM IST = FY Leave Config Reminder (conditional)
  DAILY_9AM_FY_LEAVE_REMINDER: '42 3 * * *',
  // 9:14 AM IST = Leave Approval Reminder (conditional)
  DAILY_9AM_LEAVE_APPROVAL: '44 3 * * *',
  // 9:16 AM IST = Attendance Approval Reminder (conditional)
  DAILY_9AM_ATTENDANCE_APPROVAL: '46 3 * * *',

  // Legacy - keeping for backward compatibility
  DAILY_9AM_IST: '30 3 * * *',

  // ============================================
  // MONTHLY 1ST - AUTO APPROVE (Orchestrated)
  // ============================================
  // Single orchestrator runs these in sequence:
  // 1. Auto Approve Leaves
  // 2. Auto Approve Attendance
  MONTHLY_FIRST_MIDNIGHT_ORCHESTRATOR: '30 18 1 * *', // 12:00 AM IST on 1st

  // Legacy - keeping for reference
  MONTHLY_FIRST_MIDNIGHT_IST: '30 18 1 * *',

  // 1st of every month at 12:30 AM IST = 7:00 PM UTC (prev day)
  // Runs AFTER auto-approve orchestrator completes
  MONTHLY_FIRST_1230AM_IST: '0 19 1 * *',

  // ============================================
  // FINANCIAL YEAR (April 1st) - Orchestrated
  // ============================================
  // Single orchestrator runs these in sequence:
  // 1. FY Leave Config Auto Copy
  // 2. Leave Carry Forward
  APRIL_1_ORCHESTRATOR: '30 18 1 4 *', // 12:00 AM IST on April 1

  // Legacy - keeping for reference
  APRIL_1_MIDNIGHT_IST: '30 18 1 4 *',
  APRIL_1_1AM_IST: '30 19 1 4 *',

  // ============================================
  // PAYROLL
  // ============================================
  // 2nd of every month at 1:00 AM IST = 7:30 PM UTC (prev day)
  // Runs after leave accrual to ensure all leave/attendance data is finalized
  MONTHLY_SECOND_1AM_IST: '30 19 2 * *',

  // ============================================
  // ANNOUNCEMENTS & CELEBRATIONS
  // ============================================
  // Daily at 6:00 AM IST = 12:30 AM UTC
  // For expiring announcements before work hours
  DAILY_6AM_IST: '30 0 * * *',

  // Daily at 8:00 AM IST = 2:30 AM UTC
  // For birthday and anniversary wishes before work hours
  DAILY_8AM_IST: '30 2 * * *',

  // Every 30 minutes - For publishing scheduled announcements
  EVERY_30_MINUTES: '*/30 * * * *',

  // ============================================
  // UTILITY
  // ============================================
  // Every 10 minutes
  EVERY_10_MINUTES: '*/10 * * * *',

  // March 15 at 9:00 AM IST (for FY reminders)
  MARCH_15_9AM_IST: '30 3 15 3 *',
};

export const CRON_NAMES = {
  // ============================================
  // ORCHESTRATORS (Group runners)
  // ============================================
  DAILY_MIDNIGHT_ORCHESTRATOR: 'DailyMidnightOrchestrator',
  MONTHLY_AUTO_APPROVE_ORCHESTRATOR: 'MonthlyAutoApproveOrchestrator',
  APRIL_1_FY_ORCHESTRATOR: 'April1FYOrchestrator',

  // ============================================
  // INDIVIDUAL CRONS
  // ============================================
  // Attendance
  DAILY_ATTENDANCE_ENTRY: 'DailyAttendanceEntry',
  END_OF_DAY_ATTENDANCE: 'EndOfDayAttendance',
  AUTO_APPROVE_ATTENDANCE: 'AutoApproveAttendance',
  ATTENDANCE_APPROVAL_REMINDER: 'AttendanceApprovalReminder',

  // Leave
  FY_LEAVE_CONFIG_REMINDER: 'FYLeaveConfigReminder',
  FY_LEAVE_CONFIG_AUTO_COPY: 'FYLeaveConfigAutoCopy',
  LEAVE_CARRY_FORWARD: 'LeaveCarryForward',
  AUTO_APPROVE_LEAVES: 'AutoApproveLeaves',
  MONTHLY_LEAVE_ACCRUAL: 'MonthlyLeaveAccrual',
  LEAVE_APPROVAL_REMINDER: 'LeaveApprovalReminder',

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

  // User/HR
  BIRTHDAY_ANNIVERSARY_WISHES: 'BirthdayAnniversaryWishes',
  SALARY_STRUCTURE_ACTIVATION: 'SalaryStructureActivation',

  // Config
  CONFIG_SETTING_ACTIVATION: 'ConfigSettingActivation',
};

/**
 * Cron Groups - Defines which crons run together in sequence
 * Order matters! Crons are executed in array order.
 */
export const CRON_GROUPS = {
  // Daily midnight: Config activation must happen first
  DAILY_MIDNIGHT: [
    CRON_NAMES.CONFIG_SETTING_ACTIVATION,
    CRON_NAMES.SALARY_STRUCTURE_ACTIVATION,
    CRON_NAMES.DAILY_ATTENDANCE_ENTRY,
  ],

  // Monthly 1st: Auto-approve before any accrual/payroll
  MONTHLY_AUTO_APPROVE: [CRON_NAMES.AUTO_APPROVE_LEAVES, CRON_NAMES.AUTO_APPROVE_ATTENDANCE],

  // April 1st FY transition: Config copy before carry forward
  APRIL_1_FY: [CRON_NAMES.FY_LEAVE_CONFIG_AUTO_COPY, CRON_NAMES.LEAVE_CARRY_FORWARD],
};

export const CRON_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const SYSTEM_NOTES = {
  AUTO_CREATED_BY_SYSTEM_CRON: 'Auto-created by system cron',
  HOLIDAY: 'Holiday - Auto-created by system cron',
  LEAVE: 'On leave ({leaveCategory}) - Auto-created by system cron',
  AUTO_CHECKOUT: 'Auto-checkout by system - shift end',
  MARKED_ABSENT: 'Marked absent by system - no check-in',
  AUTO_APPROVED_LEAVE: 'Auto-approved by system before payroll generation',
  AUTO_APPROVED_ATTENDANCE: 'Auto-approved by system before payroll generation',
  DRAFT_PAYROLL_GENERATED: 'Draft payroll auto-generated by system cron',
};

export const SYSTEM_DEFAULTS = {
  SYSTEM_USER_ID,
  UNKNOWN_USER_ID: 'N/A',
};

export enum CronProcessStatus {
  SUCCESS = 'success',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

export const DEFAULT_SERVICE_INTERVAL_KM = 10000;
export const DEFAULT_SERVICE_WARNING_KM = 1000;
export const DEFAULT_LEAVE_APPROVAL_REMINDER_THRESHOLD = 5;
export const DEFAULT_ATTENDANCE_APPROVAL_REMINDER_THRESHOLD = 5;
