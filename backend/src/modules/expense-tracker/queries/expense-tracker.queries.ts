import { ExpenseQueryDto } from '../dto/expense-query.dto';
import { PendingSettlementQueryDto } from '../dto/pending-settlement-query.dto';
import {
  EXPENSE_SORT_FIELD_MAPPING,
  TransactionType,
} from '../constants/expense-tracker.constants';
import { getUserSelectFields } from 'src/utils/utility/utility.service';

export const buildExpenseListQuery = (filters: ExpenseQueryDto) => {
  const {
    startDate,
    endDate,
    date,
    userIds,
    approvalStatuses,
    categories,
    search,
    sortField,
    page,
    pageSize,
    sortOrder,
  } = filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition
  whereConditions.push(`e."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Date filters
  if (date) {
    whereConditions.push(`DATE(e."expenseDate") = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      whereConditions.push(`e."expenseDate" >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`e."expenseDate" <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
  }

  // User IDs filter
  if (userIds && userIds.length > 0) {
    whereConditions.push(`e."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  // Approval statuses filter
  if (approvalStatuses && approvalStatuses.length > 0) {
    whereConditions.push(`e."approvalStatus" = ANY($${paramIndex})`);
    params.push(approvalStatuses);
    paramIndex++;
  }

  // Categories filter (e.g., Hotel, Flight, Food, Transport)
  if (categories && categories.length > 0) {
    whereConditions.push(`e."category" = ANY($${paramIndex})`);
    params.push(categories);
    paramIndex++;
  }

  // Search filter (name, email, description, amount, transaction ID)
  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR
      LOWER(e."description") LIKE LOWER($${paramIndex}) OR
      LOWER(e."transactionId") LIKE LOWER($${paramIndex}) OR
      CAST(e."amount" AS TEXT) LIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Main query for expense records
  const offset = (page - 1) * pageSize;
  const query = `
    SELECT 
      e."id",
      e."userId",
      e."category",
      e."description",
      e."amount",
      e."transactionId",
      e."expenseDate",
      e."approvalStatus",
      e."approvalBy",
      e."approvalAt",
      e."approvalReason",
      e."transactionType",
      e."paymentMode",
      e."entrySourceType",
      e."expenseEntryType",
      e."createdBy",
      e."createdAt",
      e."updatedAt",
      ${getUserSelectFields('u')},
      ${getUserSelectFields('cb', 'createdBy')},
      ${getUserSelectFields('ab', 'approvalBy')}
    FROM "expenses" e
    LEFT JOIN "users" u ON e."userId" = u."id"
    LEFT JOIN "users" cb ON e."createdBy" = cb."id"
    LEFT JOIN "users" ab ON e."approvalBy" = ab."id"
    ${whereClause}
    ORDER BY ${EXPENSE_SORT_FIELD_MAPPING[sortField] || 'e."createdAt"'} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(pageSize, offset);

  // Count query for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM "expenses" e
    LEFT JOIN "users" u ON e."userId" = u."id"
    ${whereClause}
  `;

  const countParams = params.slice(0, paramIndex - 2 + 1); // Remove limit and offset

  return {
    query,
    countQuery,
    params,
    countParams,
  };
};

export const buildExpenseBalanceQuery = (filters: ExpenseQueryDto) => {
  const { startDate, endDate, date, userIds } = filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition
  whereConditions.push(`e."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Only approved expenses for balance calculations
  whereConditions.push(`e."approvalStatus" = $${paramIndex}`);
  params.push('approved');
  paramIndex++;

  // User IDs filter
  if (userIds && userIds.length > 0) {
    whereConditions.push(`e."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  const baseWhereClause = whereConditions.join(' AND ');

  // Opening balance query (before start date or specific date)
  let openingBalanceQuery = '';
  let openingBalanceParams = [...params];
  const openingBalanceParamIndex = paramIndex;

  if (date) {
    openingBalanceQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' THEN e."amount" ELSE 0 END), 0) as "totalDebit"
      FROM "expenses" e
      LEFT JOIN "users" u ON e."userId" = u."id"
      WHERE ${baseWhereClause} AND e."expenseDate" < $${openingBalanceParamIndex}
    `;
    openingBalanceParams.push(date);
  } else if (startDate) {
    openingBalanceQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' THEN e."amount" ELSE 0 END), 0) as "totalDebit"
      FROM "expenses" e
      LEFT JOIN "users" u ON e."userId" = u."id"
      WHERE ${baseWhereClause} AND e."expenseDate" < $${openingBalanceParamIndex}
    `;
    openingBalanceParams.push(startDate);
  } else {
    // No opening balance if no date filters
    openingBalanceQuery = `SELECT 0 as "totalCredit", 0 as "totalDebit"`;
    openingBalanceParams = [];
  }

  // Current period totals query
  const periodWhereConditions = [...whereConditions];
  const periodParams = [...params];
  let periodParamIndex = paramIndex;

  // Add date filters for current period
  if (date) {
    periodWhereConditions.push(`DATE(e."expenseDate") = $${periodParamIndex}`);
    periodParams.push(date);
    periodParamIndex++;
  } else {
    if (startDate) {
      periodWhereConditions.push(`e."expenseDate" >= $${periodParamIndex}`);
      periodParams.push(startDate);
      periodParamIndex++;
    }
    if (endDate) {
      periodWhereConditions.push(`e."expenseDate" <= $${periodParamIndex}`);
      periodParams.push(endDate);
      periodParamIndex++;
    }
  }

  const periodWhereClause = periodWhereConditions.join(' AND ');

  const periodTotalsQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount" ELSE 0 END), 0) as "periodCredit",
      COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' THEN e."amount" ELSE 0 END), 0) as "periodDebit"
    FROM "expenses" e
    LEFT JOIN "users" u ON e."userId" = u."id"
    WHERE ${periodWhereClause}
  `;

  return {
    openingBalanceQuery,
    openingBalanceParams,
    periodTotalsQuery,
    periodParams,
  };
};

/**
 * Projected balance query — same as balance query but includes both 'approved' AND 'pending' expenses.
 */
export const buildProjectedBalanceQuery = (filters: ExpenseQueryDto) => {
  const { startDate, endDate, date, userIds } = filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  whereConditions.push(`e."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Include both approved and pending
  whereConditions.push(`e."approvalStatus" = ANY($${paramIndex})`);
  params.push(['approved', 'pending']);
  paramIndex++;

  if (userIds && userIds.length > 0) {
    whereConditions.push(`e."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  const baseWhereClause = whereConditions.join(' AND ');

  let openingBalanceQuery = '';
  let openingBalanceParams = [...params];
  const openingBalanceParamIndex = paramIndex;

  if (date) {
    openingBalanceQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' THEN e."amount" ELSE 0 END), 0) as "totalDebit"
      FROM "expenses" e
      LEFT JOIN "users" u ON e."userId" = u."id"
      WHERE ${baseWhereClause} AND e."expenseDate" < $${openingBalanceParamIndex}
    `;
    openingBalanceParams.push(date);
  } else if (startDate) {
    openingBalanceQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' THEN e."amount" ELSE 0 END), 0) as "totalDebit"
      FROM "expenses" e
      LEFT JOIN "users" u ON e."userId" = u."id"
      WHERE ${baseWhereClause} AND e."expenseDate" < $${openingBalanceParamIndex}
    `;
    openingBalanceParams.push(startDate);
  } else {
    openingBalanceQuery = `SELECT 0 as "totalCredit", 0 as "totalDebit"`;
    openingBalanceParams = [];
  }

  const periodWhereConditions = [...whereConditions];
  const periodParams = [...params];
  let periodParamIndex = paramIndex;

  if (date) {
    periodWhereConditions.push(`DATE(e."expenseDate") = $${periodParamIndex}`);
    periodParams.push(date);
    periodParamIndex++;
  } else {
    if (startDate) {
      periodWhereConditions.push(`e."expenseDate" >= $${periodParamIndex}`);
      periodParams.push(startDate);
      periodParamIndex++;
    }
    if (endDate) {
      periodWhereConditions.push(`e."expenseDate" <= $${periodParamIndex}`);
      periodParams.push(endDate);
      periodParamIndex++;
    }
  }

  const periodWhereClause = periodWhereConditions.join(' AND ');

  const periodTotalsQuery = `
    SELECT
      COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount" ELSE 0 END), 0) as "periodCredit",
      COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' THEN e."amount" ELSE 0 END), 0) as "periodDebit"
    FROM "expenses" e
    LEFT JOIN "users" u ON e."userId" = u."id"
    WHERE ${periodWhereClause}
  `;

  return {
    openingBalanceQuery,
    openingBalanceParams,
    periodTotalsQuery,
    periodParams,
  };
};

export const buildExpenseSummaryQuery = (filters: ExpenseQueryDto) => {
  const { startDate, endDate, date, userIds, categories } = filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition
  whereConditions.push(`e."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Date filters
  if (date) {
    whereConditions.push(`DATE(e."expenseDate") = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      whereConditions.push(`e."expenseDate" >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`e."expenseDate" <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
  }

  // User IDs filter
  if (userIds && userIds.length > 0) {
    whereConditions.push(`e."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  // Categories filter
  if (categories && categories.length > 0) {
    whereConditions.push(`e."category" = ANY($${paramIndex})`);
    params.push(categories);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const summaryQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount" ELSE 0 END), 0) as "totalCredit",
      COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' THEN e."amount" ELSE 0 END), 0) as "totalDebit",
      COUNT(*) as "totalRecords",
      COUNT(CASE WHEN e."approvalStatus" = 'pending' THEN 1 END) as "pendingCount",
      COUNT(CASE WHEN e."approvalStatus" = 'approved' THEN 1 END) as "approvedCount",
      COUNT(CASE WHEN e."approvalStatus" = 'rejected' THEN 1 END) as "rejectedCount"
    FROM "expenses" e
    LEFT JOIN "users" u ON e."userId" = u."id"
    ${whereClause}
  `;

  return {
    summaryQuery,
    params,
  };
};

export const buildPendingSettlementQuery = (filters: PendingSettlementQueryDto) => {
  const { startDate, endDate, userIds, page = 1, pageSize, sortOrder = 'DESC' } = filters;

  const whereConditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  whereConditions.push(`e."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  if (userIds && userIds.length > 0) {
    whereConditions.push(`e."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  if (startDate) {
    whereConditions.push(`e."expenseDate" >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    whereConditions.push(`e."expenseDate" <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const approvedDebitExpr = `COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.DEBIT}' AND e."approvalStatus" = 'approved' THEN e."amount"::numeric ELSE 0 END), 0)`;
  const settledExpr = `COALESCE(SUM(CASE WHEN e."transactionType" = '${TransactionType.CREDIT}' THEN e."amount"::numeric ELSE 0 END), 0)`;

  const baseSelectQuery = `
    SELECT
      u."id" AS "userId",
      u."firstName",
      u."lastName",
      u."email",
      u."employeeId",
      ${approvedDebitExpr} AS "totalApprovedAmount",
      ${settledExpr} AS "totalSettledAmount",
      (${approvedDebitExpr} - ${settledExpr}) AS "pendingAmount"
    FROM "expenses" e
    LEFT JOIN "users" u ON e."userId" = u."id"
    ${whereClause}
    GROUP BY u."id", u."firstName", u."lastName", u."email", u."employeeId"
    HAVING (${approvedDebitExpr} - ${settledExpr}) > 0
  `;

  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  let recordsQuery = `${baseSelectQuery} ORDER BY "pendingAmount" ${order}`;

  const recordParams = [...params];

  if (pageSize !== undefined) {
    const offset = (page - 1) * pageSize;
    recordsQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    recordParams.push(pageSize, offset);
  }

  const countQuery = `SELECT COUNT(*) AS total FROM (${baseSelectQuery}) subq`;

  const summaryQuery = `
    SELECT
      COALESCE(SUM(subq."totalApprovedAmount"), 0) AS "totalApprovedAmount",
      COALESCE(SUM(subq."totalSettledAmount"), 0) AS "totalSettledAmount",
      COALESCE(SUM(subq."pendingAmount"), 0) AS "totalPendingAmount"
    FROM (${baseSelectQuery}) subq
  `;

  return {
    recordsQuery,
    recordParams,
    countQuery,
    summaryQuery,
    baseParams: params,
  };
};
