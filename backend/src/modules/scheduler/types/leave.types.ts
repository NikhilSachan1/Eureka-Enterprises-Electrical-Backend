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
 * Runs on 1st of every month at 12:30 AM IST (after auto-approve cron)
 *
 * Credits monthly leaves based on config (e.g., 52 EL/year = 4-5 per month)
 * Uses cumulative calculation to ensure no decimals while totaling to annual quota
 *
 * Formula: toCredit = floor(annualQuota * currentMonth / 12) - alreadyCredited
 */
export interface MonthlyLeaveAccrualResult {
  usersProcessed: number;
  categoriesProcessed: number;
  leavesCredited: number;
  skipped: number;
  errors: string[];
}

/**
 * CRON 20
 * Leave Approval Reminder
 * Runs daily from 25th to end of month at 9:00 AM IST
 *
 * Sends reminder to HR/Admin about pending leave applications
 * that will be auto-approved if not acted upon before 1st of next month
 */
export interface LeaveApprovalReminderResult {
  emailsSent: number;
  totalPendingLeaves: number;
  recipients: string[];
  errors: string[];
}

export interface PendingLeaveAlert {
  id: string;
  userId: string;
  employeeName: string;
  employeeEmail: string;
  leaveCategory: string;
  leaveType: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
  appliedOn: Date;
  daysPending: number;
  totalDays: number;
}

export interface LeaveApprovalEmailItem {
  employeeName: string;
  leaveCategory: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  appliedOn: string;
  daysPending: number;
  isUrgent: boolean;
  statusClass: 'urgent' | 'pending';
  daysText: string;
}

export interface LeaveCategorySummary {
  category: string;
  count: number;
  displayName: string;
}

export interface LeaveApprovalEmailData {
  totalPending: number;
  totalUrgent: number;
  daysUntilAutoApproval: number;
  urgencyLevel: 'critical' | 'urgent' | 'normal';
  categorySummaries: LeaveCategorySummary[];
  urgentLeaves: LeaveApprovalEmailItem[];
  pendingLeaves: LeaveApprovalEmailItem[];
  hasUrgent: boolean;
  hasPending: boolean;
  autoApprovalDate: string;
  monthName: string;
  adminPortalUrl: string;
  currentYear: number;
}
