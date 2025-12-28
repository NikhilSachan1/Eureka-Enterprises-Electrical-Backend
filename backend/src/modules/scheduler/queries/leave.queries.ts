import { ApprovalStatus } from '../../leave-applications/constants/leave-application.constants';

/**
 * CRON 6
 * Auto Approve Pending Leaves
 * Runs on 1st of every month at 12:00 AM IST (before payroll generation)
 */
export const getPendingLeavesForPeriodQuery = (startDate: string, endDate: string) => {
  return {
    query: `
      SELECT id, "userId"
      FROM leave_applications
      WHERE "approvalStatus" = $1
        AND "toDate" >= $2::date
        AND "toDate" <= $3::date
        AND "deletedAt" IS NULL
    `,
    params: [ApprovalStatus.PENDING, startDate, endDate],
  };
};

export const autoApproveLeaveQuery = (leaveId: string, approvalReason: string) => {
  return {
    query: `
      UPDATE leave_applications 
      SET "approvalStatus" = $1, 
          "approvalAt" = $2, 
          "approvalReason" = $3,
          "updatedAt" = $2
      WHERE id = $4
    `,
    params: [ApprovalStatus.APPROVED, new Date(), approvalReason, leaveId],
  };
};
