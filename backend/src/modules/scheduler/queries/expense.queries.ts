import { ExpenseType } from '../types/expense.types';

/**
 * Expense Queries
 *
 * Queries for CRON 16: Pending Expense Approval Reminders
 *
 * Fetches expenses that are:
 * - In PENDING approval status
 * - Active (isActive = true) - latest version only
 * - Not deleted (deletedAt IS NULL)
 *
 * Combines both regular expenses and fuel expenses
 */

export const getPendingRegularExpensesQuery = () => {
  return {
    query: `
      SELECT
        e.id,
        '${ExpenseType.REGULAR}' as "expenseType",
        e."userId",
        u."firstName",
        u."lastName",
        u."email",
        e.category,
        e.description,
        e.amount::numeric as amount,
        e."expenseDate",
        e."createdAt",
        (CURRENT_DATE - e."createdAt"::date) as "daysPending"
      FROM expenses e
      INNER JOIN users u ON u.id = e."userId" AND u."deletedAt" IS NULL
      WHERE e."deletedAt" IS NULL
        AND e."isActive" = true
        AND LOWER(e."approvalStatus") = 'pending'
      ORDER BY e."createdAt" ASC
    `,
    params: [],
  };
};

export const getPendingFuelExpensesQuery = () => {
  return {
    query: `
      SELECT
        fe.id,
        '${ExpenseType.FUEL}' as "expenseType",
        fe."userId",
        u."firstName",
        u."lastName",
        u."email",
        'Fuel' as category,
        COALESCE(fe.description, 'Fuel expense') as description,
        fe."fuelAmount"::numeric as amount,
        fe."fillDate" as "expenseDate",
        fe."createdAt",
        (CURRENT_DATE - fe."createdAt"::date) as "daysPending",
        vm."registrationNo" as "vehicleRegistrationNo",
        fe."fuelLiters"::numeric as "fuelLiters"
      FROM fuel_expenses fe
      INNER JOIN users u ON u.id = fe."userId" AND u."deletedAt" IS NULL
      LEFT JOIN vehicle_masters vm ON vm.id = fe."vehicleId" AND vm."deletedAt" IS NULL
      WHERE fe."deletedAt" IS NULL
        AND fe."isActive" = true
        AND UPPER(fe."approvalStatus") = 'PENDING'
      ORDER BY fe."createdAt" ASC
    `,
    params: [],
  };
};

/**
 * Get summary counts of pending expenses
 * Used for dashboard/reporting
 * TODO: This can be used to get the total number of pending expenses, and can be shown on dashboard
 */
export const getPendingExpenseSummaryQuery = (urgentThresholdDays: number) => {
  return {
    query: `
      WITH regular_pending AS (
        SELECT 
          COUNT(*) as count,
          COUNT(CASE WHEN (CURRENT_DATE - "createdAt"::date) >= $1 THEN 1 END) as urgent_count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM expenses
        WHERE "deletedAt" IS NULL
          AND "isActive" = true
          AND LOWER("approvalStatus") = 'pending'
      ),
      fuel_pending AS (
        SELECT 
          COUNT(*) as count,
          COUNT(CASE WHEN (CURRENT_DATE - "createdAt"::date) >= $1 THEN 1 END) as urgent_count,
          COALESCE(SUM("fuelAmount"), 0) as total_amount
        FROM fuel_expenses
        WHERE "deletedAt" IS NULL
          AND "isActive" = true
          AND UPPER("approvalStatus") = 'PENDING'
      )
      SELECT
        (SELECT count FROM regular_pending)::int as "regularCount",
        (SELECT count FROM fuel_pending)::int as "fuelCount",
        (SELECT urgent_count FROM regular_pending)::int + (SELECT urgent_count FROM fuel_pending)::int as "urgentCount",
        (SELECT total_amount FROM regular_pending) + (SELECT total_amount FROM fuel_pending) as "totalAmount"
    `,
    params: [urgentThresholdDays],
  };
};

/**
 * Default threshold for urgent expenses (days)
 */
export const DEFAULT_URGENT_THRESHOLD_DAYS = 7;

/**
 * Format expense category for display
 */
export const formatExpenseCategory = (category: string): string => {
  if (!category) return 'Uncategorized';
  // Convert snake_case or UPPER_CASE to Title Case
  return category
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
