/**
 * CRON 8
 * Monthly Payroll Generation
 * Runs on 2nd of every month at 1:00 AM IST
 *
 * Generates DRAFT payroll records for:
 * 1. Active employees with active salary structure
 * 2. Archived employees who have attendance records in the payroll month
 *
 * This ensures:
 * - Auto-approve leaves has run (1st 12:00 AM)
 * - Leave accrual has run (1st 12:30 AM)
 * - All attendance data is finalized
 *
 * Workflow: DRAFT → GENERATED → APPROVED → PAID
 * Admin reviews DRAFT and transitions to GENERATED for finalization.
 */
export interface MonthlyPayrollGenerationResult {
  month: number;
  year: number;
  totalProcessed: number;
  activeUsersProcessed: number;
  archivedUsersProcessed: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  skipped: PayrollSkippedUser[];
  errors: PayrollError[];
}

export interface PayrollSkippedUser {
  userId: string;
  reason: string;
}

export interface PayrollError {
  userId: string;
  error: string;
}
