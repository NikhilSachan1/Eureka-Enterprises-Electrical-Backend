import { ExpenseQueryDto } from '../dto/expense-query.dto';
import {
  EXPENSE_SORT_FIELD_MAPPING,
  TransactionType,
} from '../constants/expense-tracker.constants';
import { getUserSelectFields } from 'src/utils/master-constants/master-constants';

export const buildExpenseListQuery = (filters: ExpenseQueryDto) => {
  const {
    startDate,
    endDate,
    date,
    userIds,
    approvalStatuses,
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

  // Search filter (name, email, employee ID)
  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR 
      LOWER(e."description") LIKE LOWER($${paramIndex})
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
      e."createdAt",
      e."updatedAt",
      ${getUserSelectFields('u')},
      ${getUserSelectFields('ab', 'approvalBy')}
    FROM "expenses" e
    LEFT JOIN "users" u ON e."userId" = u."id"
    LEFT JOIN "users" ab ON e."approvalBy" = ab."id"
    LEFT JOIN "expense_files" ef ON e."id" = ef."expenseId"
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
  const { startDate, endDate, date, userIds, approvalStatuses, search } = filters;

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

  // Search filter (if provided)
  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR 
      LOWER(e."description") LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Approval statuses filter - ADDED LATER
  if (approvalStatuses && approvalStatuses.length > 0) {
    whereConditions.push(`e."approvalStatus" = ANY($${paramIndex})`);
    params.push(approvalStatuses);
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

export const buildExpenseSummaryQuery = (filters: ExpenseQueryDto) => {
  const { startDate, endDate, date, userIds, approvalStatuses, search } = filters;

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

  // Search filter
  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR 
      LOWER(e."description") LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${search}%`);
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

// TODO: Confirm the query is correct, whenever tested with the frontend.
