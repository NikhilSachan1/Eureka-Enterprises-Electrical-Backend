import { AttendanceStatus } from 'src/modules/attendance/constants/attendance.constants';
import { UserStatus } from 'src/modules/users/constants/user.constants';
import {
  ALLOCATION_ENTRY_TYPES,
  CONSUMPTION_ENTRY_TYPES,
  LeaveLedgerEntryType,
} from '../constants/leave-ledger.constants';

/** The summary row, locked for the rest of the transaction. */
export const lockLeaveBalanceQuery = (
  userId: string,
  leaveCategory: string,
  financialYear: string,
) => ({
  query: `
    SELECT id, "totalAllocated", consumed
      FROM leave_balances
     WHERE "userId" = $1 AND "leaveCategory" = $2 AND "financialYear" = $3
       AND "deletedAt" IS NULL
     ORDER BY "totalAllocated"::numeric DESC
     LIMIT 1
     FOR UPDATE
  `,
  params: [userId, leaveCategory, financialYear],
});

export const createEmptyLeaveBalanceQuery = (
  userId: string,
  leaveConfigId: string,
  leaveCategory: string,
  financialYear: string,
) => ({
  query: `
    INSERT INTO leave_balances
      ("userId", "leaveConfigId", "leaveCategory", "financialYear", "creditSource",
       "totalAllocated", "carriedForward", consumed, adjusted, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, 'ledger', '0', '0', '0', '0', NOW(), NOW())
    ON CONFLICT ("userId", "leaveCategory", "financialYear") DO NOTHING
  `,
  params: [userId, leaveConfigId, leaveCategory, financialYear],
});

/** Re-derives the summary from the ledger, so the two can never drift apart. */
export const syncLeaveBalanceFromLedgerQuery = (balanceId: string) => ({
  query: `
    UPDATE leave_balances lb
       SET "totalAllocated" = totals.allocated::text,
           consumed = totals.consumed::text,
           "updatedAt" = NOW()
      FROM (
        SELECT
          COALESCE(SUM(days) FILTER (WHERE "entryType" = ANY($2)), 0) AS allocated,
          COALESCE(-SUM(days) FILTER (WHERE "entryType" = ANY($3)), 0) AS consumed
          FROM leave_ledger_entries e
          JOIN leave_balances b ON b.id = $1
         WHERE e."userId" = b."userId"
           AND e."leaveCategory" = b."leaveCategory"
           AND e."financialYear" = b."financialYear"
           AND e."deletedAt" IS NULL
      ) totals
     WHERE lb.id = $1
     RETURNING lb."totalAllocated", lb.consumed
  `,
  params: [balanceId, ALLOCATION_ENTRY_TYPES, CONSUMPTION_ENTRY_TYPES],
});

export const applicationForReversalQuery = {
  query: `
    SELECT id, "userId", "leaveCategory", "createdAt",
           to_char("fromDate", 'YYYY-MM-DD') AS "fromDate"
      FROM leave_applications
     WHERE id = $1
  `,
};

/** Net days the ledger holds against one leave application day (debit -1, give-back +1). */
export const applicationNetDaysQuery = (leaveApplicationId: string) => ({
  query: `
    SELECT COUNT(*)::int AS entries, COALESCE(SUM(days), 0)::numeric AS net
      FROM leave_ledger_entries
     WHERE "leaveApplicationId" = $1 AND "deletedAt" IS NULL
  `,
  params: [leaveApplicationId],
});

/** Sum of the given entry types, optionally only those settling a month up to `throughMonth`. */
export const sumEntriesQuery = (
  userId: string,
  leaveCategory: string,
  financialYear: string,
  entryTypes: readonly LeaveLedgerEntryType[],
  throughMonth?: string,
) => ({
  query: `
    SELECT COALESCE(SUM(days), 0)::numeric AS total
      FROM leave_ledger_entries
     WHERE "userId" = $1 AND "leaveCategory" = $2 AND "financialYear" = $3
       AND "entryType" = ANY($4) AND "deletedAt" IS NULL
       ${throughMonth ? `AND ("periodMonth" IS NULL OR "periodMonth" <= $5::date)` : ''}
  `,
  params: throughMonth
    ? [userId, leaveCategory, financialYear, entryTypes, `${throughMonth}-01`]
    : [userId, leaveCategory, financialYear, entryTypes],
});

/** Employees whose leave accrues: active EMPLOYEE / DRIVER, as the old cron picked them. */
export const getAccrualUsersQuery = (userIds?: string[]) => ({
  query: `
    SELECT u.id, to_char(u."dateOfJoining", 'YYYY-MM-DD') AS "dateOfJoining"
      FROM users u
     WHERE u.status = $1
       AND u."deletedAt" IS NULL
       AND EXISTS (
         SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id = ur."roleId" AND r."deletedAt" IS NULL
        WHERE ur."userId" = u.id AND r.name IN ('EMPLOYEE', 'DRIVER')
       )
       ${userIds?.length ? 'AND u.id = ANY($2)' : ''}
  `,
  params: userIds?.length ? [UserStatus.ACTIVE, userIds] : [UserStatus.ACTIVE],
});

/**
 * Per user per month counts of the statuses payroll pays for. A row still waiting for approval
 * counts as it stands (only a rejected one is left out): settlement runs on the 1st, often before
 * HR has approved last month, and an unapproved present day must not read as an absence.
 */
export const monthlyAttendanceCountsQuery = (
  userIds: string[],
  fromDate: string,
  toDate: string,
) => ({
  query: `
    SELECT a."userId",
           to_char(a."attendanceDate", 'YYYY-MM') AS month,
           COUNT(*) FILTER (WHERE a.status IN ('${AttendanceStatus.PRESENT}', '${AttendanceStatus.APPROVAL_PENDING}'))::int AS "presentDays",
           COUNT(*) FILTER (WHERE a.status = '${AttendanceStatus.HALF_DAY}')::int AS "halfDays",
           COUNT(*) FILTER (WHERE a.status = '${AttendanceStatus.LEAVE}')::int AS "paidLeaveDays"
      FROM attendances a
     WHERE a."userId" = ANY($1)
       AND a."attendanceDate" >= $2::date
       AND a."attendanceDate" <= $3::date
       AND a."isActive" = true
       AND a."deletedAt" IS NULL
       AND a."approvalStatus" <> 'rejected'
     GROUP BY 1, 2
  `,
  params: [userIds, fromDate, toDate],
});

/**
 * Paid leave days in a range that the ledger still holds as taken (not already converted),
 * latest first: the ones settlement may turn into LWP.
 */
export const convertibleLeaveDaysQuery = (
  userId: string,
  leaveCategory: string,
  fromDate: string,
  toDate: string,
) => ({
  query: `
    SELECT a.id AS "attendanceId",
           to_char(a."attendanceDate", 'YYYY-MM-DD') AS date,
           la.id AS "leaveApplicationId"
      FROM attendances a
      JOIN leave_applications la
        ON la."userId" = a."userId"
       AND la."leaveCategory" = $2
       AND la."approvalStatus" = 'approved'
       AND la."deletedAt" IS NULL
       AND la."fromDate"::date <= a."attendanceDate"
       AND la."toDate"::date >= a."attendanceDate"
     WHERE a."userId" = $1
       AND a.status = '${AttendanceStatus.LEAVE}'
       AND a."isActive" = true
       AND a."deletedAt" IS NULL
       AND a."attendanceDate" >= $3::date
       AND a."attendanceDate" <= $4::date
       AND (
         SELECT COALESCE(SUM(e.days), 0) FROM leave_ledger_entries e
          WHERE e."leaveApplicationId" = la.id AND e."deletedAt" IS NULL
       ) < 0
     ORDER BY a."attendanceDate" DESC
  `,
  params: [userId, leaveCategory, fromDate, toDate],
});

export const ledgerEntriesQuery = (
  userId: string,
  leaveCategory: string,
  financialYear: string,
) => ({
  query: `
    SELECT e.id::text AS id,
           to_char(e."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS') AS "createdAt",
           e."entryType", e.days::float AS days,
           e."periodMonth"::text AS "periodMonth", e.reason, e."leaveApplicationId",
           to_char(la."fromDate", 'YYYY-MM-DD') AS "leaveDate",
           CASE WHEN cb.id IS NULL THEN NULL
                ELSE json_build_object('id', cb.id, 'firstName', cb."firstName", 'lastName', cb."lastName")
           END AS "createdBy"
      FROM leave_ledger_entries e
      LEFT JOIN leave_applications la ON la.id = e."leaveApplicationId"
      LEFT JOIN users cb ON cb.id = e."createdBy"
     WHERE e."userId" = $1 AND e."leaveCategory" = $2 AND e."financialYear" = $3
       AND e."deletedAt" IS NULL
     ORDER BY e."createdAt" ASC, e.id ASC
  `,
  params: [userId, leaveCategory, financialYear],
});
