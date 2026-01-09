export enum TriggerableCronJob {
  // Daily Midnight - Sequential (Order matters)
  CONFIG_ACTIVATION = 'CONFIG_ACTIVATION',
  SALARY_STRUCTURE_ACTIVATION = 'SALARY_STRUCTURE_ACTIVATION',
  DAILY_ATTENDANCE_ENTRY = 'DAILY_ATTENDANCE_ENTRY',
  AUTO_APPROVE_ATTENDANCE = 'AUTO_APPROVE_ATTENDANCE',
  FY_LEAVE_CONFIG_AUTO_COPY = 'FY_LEAVE_CONFIG_AUTO_COPY',
  LEAVE_CARRY_FORWARD = 'LEAVE_CARRY_FORWARD',
  AUTO_APPROVE_LEAVES = 'AUTO_APPROVE_LEAVES',

  // Daily End of Shift (Evening)
  END_OF_DAY_ATTENDANCE = 'END_OF_DAY_ATTENDANCE',

  // Daily 9 AM - Independent Alerts/Reminders
  CARD_EXPIRY_ALERT = 'CARD_EXPIRY_ALERT',
  ASSET_CALIBRATION_EXPIRY_ALERT = 'ASSET_CALIBRATION_EXPIRY_ALERT',
  ASSET_WARRANTY_EXPIRY_ALERT = 'ASSET_WARRANTY_EXPIRY_ALERT',
  VEHICLE_DOCUMENT_EXPIRY_ALERT = 'VEHICLE_DOCUMENT_EXPIRY_ALERT',
  VEHICLE_SERVICE_DUE_REMINDER = 'VEHICLE_SERVICE_DUE_REMINDER',
  PENDING_EXPENSE_REMINDER = 'PENDING_EXPENSE_REMINDER',
  FY_LEAVE_CONFIG_REMINDER = 'FY_LEAVE_CONFIG_REMINDER',
  LEAVE_APPROVAL_REMINDER = 'LEAVE_APPROVAL_REMINDER',
  ATTENDANCE_APPROVAL_REMINDER = 'ATTENDANCE_APPROVAL_REMINDER',

  // Daily 8 AM - Celebration
  CELEBRATION_WISHES = 'CELEBRATION_WISHES',

  // Monthly
  MONTHLY_PAYROLL_GENERATION = 'MONTHLY_PAYROLL_GENERATION',
  MONTHLY_LEAVE_ACCRUAL = 'MONTHLY_LEAVE_ACCRUAL',

  // Announcements
  PUBLISH_SCHEDULED_ANNOUNCEMENTS = 'PUBLISH_SCHEDULED_ANNOUNCEMENTS',
  EXPIRE_ANNOUNCEMENTS = 'EXPIRE_ANNOUNCEMENTS',

  // Orchestrators (Run groups of dependent crons in sequence)
  DAILY_MIDNIGHT_ORCHESTRATOR = 'DAILY_MIDNIGHT_ORCHESTRATOR',
  MONTHLY_AUTO_APPROVE_ORCHESTRATOR = 'MONTHLY_AUTO_APPROVE_ORCHESTRATOR',
  APRIL_1_FY_ORCHESTRATOR = 'APRIL_1_FY_ORCHESTRATOR',
}

// Jobs that require specific parameters
export const JOBS_REQUIRING_DATE: TriggerableCronJob[] = [
  TriggerableCronJob.DAILY_ATTENDANCE_ENTRY,
  TriggerableCronJob.END_OF_DAY_ATTENDANCE,
  TriggerableCronJob.CELEBRATION_WISHES,
];

export const JOBS_REQUIRING_MONTH_YEAR: TriggerableCronJob[] = [
  TriggerableCronJob.MONTHLY_PAYROLL_GENERATION,
  TriggerableCronJob.MONTHLY_LEAVE_ACCRUAL,
];

export const JOBS_REQUIRING_YEAR: TriggerableCronJob[] = [
  TriggerableCronJob.FY_LEAVE_CONFIG_AUTO_COPY,
  TriggerableCronJob.LEAVE_CARRY_FORWARD,
];

// Dependency graph - job can only run if dependencies are satisfied
export const CRON_DEPENDENCIES: Record<TriggerableCronJob, TriggerableCronJob[]> = {
  // Config must activate before salary structure
  [TriggerableCronJob.CONFIG_ACTIVATION]: [],
  [TriggerableCronJob.SALARY_STRUCTURE_ACTIVATION]: [TriggerableCronJob.CONFIG_ACTIVATION],

  // Attendance entry before end of day, approval needs attendance
  [TriggerableCronJob.DAILY_ATTENDANCE_ENTRY]: [
    TriggerableCronJob.CONFIG_ACTIVATION,
    TriggerableCronJob.SALARY_STRUCTURE_ACTIVATION,
  ],
  [TriggerableCronJob.END_OF_DAY_ATTENDANCE]: [TriggerableCronJob.DAILY_ATTENDANCE_ENTRY],
  [TriggerableCronJob.AUTO_APPROVE_ATTENDANCE]: [TriggerableCronJob.DAILY_ATTENDANCE_ENTRY],

  // FY config before carry forward
  [TriggerableCronJob.FY_LEAVE_CONFIG_AUTO_COPY]: [TriggerableCronJob.CONFIG_ACTIVATION],
  [TriggerableCronJob.LEAVE_CARRY_FORWARD]: [TriggerableCronJob.FY_LEAVE_CONFIG_AUTO_COPY],
  [TriggerableCronJob.AUTO_APPROVE_LEAVES]: [],

  // Independent jobs - no dependencies
  [TriggerableCronJob.CARD_EXPIRY_ALERT]: [],
  [TriggerableCronJob.ASSET_CALIBRATION_EXPIRY_ALERT]: [],
  [TriggerableCronJob.ASSET_WARRANTY_EXPIRY_ALERT]: [],
  [TriggerableCronJob.VEHICLE_DOCUMENT_EXPIRY_ALERT]: [],
  [TriggerableCronJob.VEHICLE_SERVICE_DUE_REMINDER]: [],
  [TriggerableCronJob.PENDING_EXPENSE_REMINDER]: [],
  [TriggerableCronJob.FY_LEAVE_CONFIG_REMINDER]: [],
  [TriggerableCronJob.LEAVE_APPROVAL_REMINDER]: [],
  [TriggerableCronJob.ATTENDANCE_APPROVAL_REMINDER]: [],
  [TriggerableCronJob.CELEBRATION_WISHES]: [],

  // Monthly jobs - payroll requires attendance and leaves processed
  [TriggerableCronJob.MONTHLY_PAYROLL_GENERATION]: [
    TriggerableCronJob.AUTO_APPROVE_ATTENDANCE,
    TriggerableCronJob.AUTO_APPROVE_LEAVES,
  ],
  [TriggerableCronJob.MONTHLY_LEAVE_ACCRUAL]: [],

  // Announcements - independent
  [TriggerableCronJob.PUBLISH_SCHEDULED_ANNOUNCEMENTS]: [],
  [TriggerableCronJob.EXPIRE_ANNOUNCEMENTS]: [],

  // Orchestrators - no dependencies (they manage their own groups)
  [TriggerableCronJob.DAILY_MIDNIGHT_ORCHESTRATOR]: [],
  [TriggerableCronJob.MONTHLY_AUTO_APPROVE_ORCHESTRATOR]: [],
  [TriggerableCronJob.APRIL_1_FY_ORCHESTRATOR]: [],
};

// Job descriptions for documentation
export const CRON_JOB_DESCRIPTIONS: Record<TriggerableCronJob, string> = {
  [TriggerableCronJob.CONFIG_ACTIVATION]:
    'Activates/deactivates config settings based on their effective dates',
  [TriggerableCronJob.SALARY_STRUCTURE_ACTIVATION]:
    'Activates/deactivates salary structures based on their effective dates',
  [TriggerableCronJob.DAILY_ATTENDANCE_ENTRY]:
    'Creates attendance entries for all active employees for a specific date',
  [TriggerableCronJob.END_OF_DAY_ATTENDANCE]:
    'Finalizes attendance at shift end - auto-checkout users and mark NOT_CHECKED_IN as ABSENT',
  [TriggerableCronJob.AUTO_APPROVE_ATTENDANCE]:
    'Auto-approves pending attendance records past the approval window',
  [TriggerableCronJob.FY_LEAVE_CONFIG_AUTO_COPY]:
    'Copies leave configuration to the new financial year',
  [TriggerableCronJob.LEAVE_CARRY_FORWARD]:
    'Carries forward eligible leave balances to the new financial year',
  [TriggerableCronJob.AUTO_APPROVE_LEAVES]:
    'Auto-approves pending leave applications past the approval window',
  [TriggerableCronJob.CARD_EXPIRY_ALERT]: 'Sends alerts for cards expiring soon or expired',
  [TriggerableCronJob.ASSET_CALIBRATION_EXPIRY_ALERT]:
    'Sends alerts for assets with calibration expiring soon',
  [TriggerableCronJob.ASSET_WARRANTY_EXPIRY_ALERT]:
    'Sends alerts for assets with warranty expiring soon',
  [TriggerableCronJob.VEHICLE_DOCUMENT_EXPIRY_ALERT]:
    'Sends alerts for vehicle documents expiring soon',
  [TriggerableCronJob.VEHICLE_SERVICE_DUE_REMINDER]: 'Sends reminders for vehicles due for service',
  [TriggerableCronJob.PENDING_EXPENSE_REMINDER]: 'Sends reminders for pending expense approvals',
  [TriggerableCronJob.FY_LEAVE_CONFIG_REMINDER]:
    'Sends reminder to configure leaves for upcoming financial year',
  [TriggerableCronJob.LEAVE_APPROVAL_REMINDER]: 'Sends reminders for pending leave approvals',
  [TriggerableCronJob.ATTENDANCE_APPROVAL_REMINDER]:
    'Sends reminders for pending attendance approvals',
  [TriggerableCronJob.CELEBRATION_WISHES]:
    'Sends birthday and work anniversary wishes for a specific date',
  [TriggerableCronJob.MONTHLY_PAYROLL_GENERATION]:
    'Generates payroll for all employees for a specific month',
  [TriggerableCronJob.MONTHLY_LEAVE_ACCRUAL]: 'Credits monthly leave accruals to employees',
  [TriggerableCronJob.PUBLISH_SCHEDULED_ANNOUNCEMENTS]:
    'Publishes announcements scheduled for today',
  [TriggerableCronJob.EXPIRE_ANNOUNCEMENTS]: 'Expires announcements past their end date',
  [TriggerableCronJob.DAILY_MIDNIGHT_ORCHESTRATOR]:
    'Orchestrator: Runs Config → Salary → Attendance → Auto-Approve sequence at midnight',
  [TriggerableCronJob.MONTHLY_AUTO_APPROVE_ORCHESTRATOR]:
    'Orchestrator: Runs Auto-Approve Attendance → Auto-Approve Leaves on 1st of month',
  [TriggerableCronJob.APRIL_1_FY_ORCHESTRATOR]:
    'Orchestrator: Runs FY Leave Config Copy → Leave Carry Forward on April 1st',
};

export const CRON_TRIGGER_ERRORS = {
  JOB_NOT_FOUND: 'Cron job not found',
  INVALID_JOB_NAME: 'Invalid cron job name',
  DATE_REQUIRED: 'Date is required for this job',
  MONTH_YEAR_REQUIRED: 'Month and year are required for this job',
  YEAR_REQUIRED: 'Year is required for this job',
  FUTURE_DATE_NOT_ALLOWED: 'Cannot trigger cron for future dates',
  FUTURE_MONTH_NOT_ALLOWED: 'Cannot trigger payroll for future months',
  DEPENDENCY_NOT_MET: 'Dependency not met: {dependency} must run before {job}',
  ALREADY_PROCESSED: 'This job has already been processed for the specified period',
  JOB_IN_PROGRESS: 'This job is currently in progress',
  RATE_LIMITED: 'Too many requests. Please wait before triggering again',
  INVALID_MONTH: 'Month must be between 1 and 12',
  INVALID_YEAR: 'Year must be a valid year',
};

export const CRON_TRIGGER_SUCCESS = {
  JOB_TRIGGERED: 'Cron job triggered successfully',
  JOB_COMPLETED: 'Cron job completed successfully',
  DRY_RUN_COMPLETE: 'Dry run completed. No changes were made.',
};
