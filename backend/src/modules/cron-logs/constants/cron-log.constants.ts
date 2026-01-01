export enum CronJobStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum CronJobType {
  CARD = 'CARD',
  ASSET = 'ASSET',
  VEHICLE = 'VEHICLE',
  ATTENDANCE = 'ATTENDANCE',
  LEAVE = 'LEAVE',
  EXPENSE = 'EXPENSE',
  PAYROLL = 'PAYROLL',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  CELEBRATION = 'CELEBRATION',
  CONFIG = 'CONFIG',
  CLEANUP = 'CLEANUP',
  NOTIFICATION = 'NOTIFICATION',
  SALARY_STRUCTURE = 'SALARY_STRUCTURE',
}

export enum CronTriggerType {
  SYSTEM = 'SYSTEM', // Automatic scheduled execution
  MANUAL = 'MANUAL', // Manually triggered via API (for testing/emergency)
}

export const CRON_LOG_ERRORS = {
  NOT_FOUND: 'Cron log not found',
  ALREADY_COMPLETED: 'Cron job already completed',
};

export const CRON_LOG_RESPONSES = {
  CLEANUP: `Deleted {deletedCount} old cron logs older than {retentionDays} days`,
};

export const DEFAULT_CRON_LOG_RETENTION_DAYS = 30;
