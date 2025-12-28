import { ApprovalStatus } from '../../leave-applications/constants/leave-application.constants';
import { UserStatus } from '../../users/constants/user.constants';

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

/**
 * CRON 7
 * Monthly Leave Accrual
 */
export const getActiveUsersQuery = () => {
  return {
    query: `
      SELECT id
      FROM users
      WHERE status = $1
        AND "deletedAt" IS NULL
    `,
    params: [UserStatus.ACTIVE],
  };
};

export const getUserLeaveBalanceQuery = (
  userId: string,
  leaveCategory: string,
  financialYear: string,
) => {
  return {
    query: `
      SELECT id, "totalAllocated"
      FROM leave_balances
      WHERE "userId" = $1
        AND "leaveCategory" = $2
        AND "financialYear" = $3
        AND "deletedAt" IS NULL
    `,
    params: [userId, leaveCategory, financialYear],
  };
};

export const updateLeaveBalanceQuery = (
  balanceId: string,
  newTotalAllocated: number,
  notes: string,
) => {
  return {
    query: `
      UPDATE leave_balances
      SET "totalAllocated" = $1,
          "notes" = CASE 
            WHEN "notes" IS NULL OR "notes" = '' THEN $2
            ELSE "notes" || ' / ' || $2
          END,
          "updatedAt" = $3
      WHERE id = $4
    `,
    params: [newTotalAllocated.toString(), notes, new Date(), balanceId],
  };
};

export const createLeaveBalanceQuery = (
  userId: string,
  leaveConfigId: string,
  leaveCategory: string,
  financialYear: string,
  totalAllocated: number,
  creditSource: string,
  notes: string,
) => {
  return {
    query: `
      INSERT INTO leave_balances (
        "userId", "leaveConfigId", "leaveCategory", "financialYear",
        "totalAllocated", "creditSource", "notes", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING id
    `,
    params: [
      userId,
      leaveConfigId,
      leaveCategory,
      financialYear,
      totalAllocated.toString(),
      creditSource,
      notes,
      new Date(),
    ],
  };
};
