/**
 * CRON 3
 * Financial Year Leave Config Change Reminder
 * Runs DAILY at 9:00 AM IST from March 15 to March 31
 *
 * Sends email reminder to HR/Admin about reviewing leave configurations
 * before the new financial year starts on April 1st
 */
export interface FYLeaveConfigReminderResult {
  emailsSent: number;
  recipients: string[];
  errors: string[];
}

/**
 * CRON 4
 * Financial Year Leave Config Auto Copy
 * Runs on April 1 at 12:00 AM IST
 *
 * If leave config for new FY is not updated, copies previous year's config
 * Creates with isActive: false - activated by Config Activation Cron
 */
export interface FYLeaveConfigAutoCopyResult {
  configsCopied: number;
  configsSkipped: number;
  errors: string[];
}

/**
 * CRON 5
 * Leave Carry Forward
 * Runs on April 1 at 12:00 AM IST (after config copy)
 *
 * Carries forward eligible leaves from previous FY to new FY
 */
export interface LeaveCarryForwardResult {
  usersProcessed: number;
  leavesCarriedForward: number;
  errors: string[];
}

/**
 * CRON 6
 * Auto Approve Pending Leaves
 * Runs on 1st of every month at 12:00 AM IST (before payroll generation)
 *
 * Auto-approves all pending leave applications for the previous month
 * This ensures leaves are counted in payroll even if admin forgot to approve
 */
export interface AutoApproveLeavesResult {
  leavesApproved: number;
  errors: string[];
}

/**
 * CRON 7
 * Monthly Leave Accrual
 * Runs on 1st of every month
 *
 * Credits monthly leaves (e.g., 1.5 EL per month) to eligible employees
 */
export interface MonthlyLeaveAccrualResult {
  usersProcessed: number;
  leavesCredited: number;
  errors: string[];
}
