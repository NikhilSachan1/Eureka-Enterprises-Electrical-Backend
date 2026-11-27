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

export const autoApproveLeaveQuery = (
  leaveId: string,
  approvalReason: string,
  systemUserId: string,
) => {
  return {
    query: `
      UPDATE leave_applications 
      SET "approvalStatus" = $1, 
          "approvalAt" = $2, 
          "approvalReason" = $3,
          "approvalBy" = $4,
          "updatedBy" = $4,
          "updatedAt" = $2
      WHERE id = $5
    `,
    params: [ApprovalStatus.APPROVED, new Date(), approvalReason, systemUserId, leaveId],
  };
};

/**
 * CRON 20
 * Leave Approval Reminder
 */
export const getPendingLeavesForCurrentMonthQuery = (startDate: string, endDate: string) => {
  return {
    query: `
      SELECT 
        la.id,
        la."userId",
        CONCAT(u."firstName", ' ', u."lastName") as "employeeName",
        u."email" as "employeeEmail",
        la."leaveCategory",
        la."leaveType",
        la."fromDate",
        la."toDate",
        la."reason",
        la."createdAt" as "appliedOn",
        EXTRACT(DAY FROM NOW() - la."createdAt")::integer as "daysPending",
        CASE 
          WHEN la."leaveType" = 'HALF_DAY' THEN 0.5
          ELSE (la."toDate"::date - la."fromDate"::date + 1)
        END as "totalDays"
      FROM leave_applications la
      INNER JOIN users u ON u.id = la."userId" AND u."deletedAt" IS NULL
      WHERE la."approvalStatus" = $1
        AND (
          -- Leave falls within the month OR overlaps with the month
          (la."fromDate" >= $2::date AND la."fromDate" <= $3::date)
          OR (la."toDate" >= $2::date AND la."toDate" <= $3::date)
          OR (la."fromDate" <= $2::date AND la."toDate" >= $3::date)
        )
        AND la."deletedAt" IS NULL
      ORDER BY la."createdAt" ASC
    `,
    params: [ApprovalStatus.PENDING, startDate, endDate],
  };
};

export const getPendingLeavesByCategoryQuery = (startDate: string, endDate: string) => {
  return {
    query: `
      SELECT 
        la."leaveCategory" as "category",
        COUNT(*)::integer as "count"
      FROM leave_applications la
      WHERE la."approvalStatus" = $1
        AND (
          (la."fromDate" >= $2::date AND la."fromDate" <= $3::date)
          OR (la."toDate" >= $2::date AND la."toDate" <= $3::date)
          OR (la."fromDate" <= $2::date AND la."toDate" >= $3::date)
        )
        AND la."deletedAt" IS NULL
      GROUP BY la."leaveCategory"
      ORDER BY COUNT(*) DESC
    `,
    params: [ApprovalStatus.PENDING, startDate, endDate],
  };
};

export const LEAVE_URGENT_THRESHOLD_DAYS = 5;
