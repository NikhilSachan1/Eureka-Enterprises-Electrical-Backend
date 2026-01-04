import { FuelExpenseQueryDto } from '../dto/fuel-expense-query.dto';
import { TransactionType } from '../constants/fuel-expense.constants';
import { getUserSelectFields } from 'src/utils/utility/utility.service';

export const buildFuelExpenseListQuery = (filters: FuelExpenseQueryDto) => {
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
    vehicleId,
    cardId,
  } = filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition - only active records
  whereConditions.push(`fe."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Date filters
  if (date) {
    whereConditions.push(`DATE(fe."fillDate") = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      whereConditions.push(`fe."fillDate" >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`fe."fillDate" <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
  }

  // Vehicle ID filter
  if (vehicleId) {
    whereConditions.push(`fe."vehicleId" = $${paramIndex}`);
    params.push(vehicleId);
    paramIndex++;
  }

  // Card ID filter
  if (cardId) {
    whereConditions.push(`fe."cardId" = $${paramIndex}`);
    params.push(cardId);
    paramIndex++;
  }

  // User IDs filter
  if (userIds && userIds.length > 0) {
    whereConditions.push(`fe."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  // Approval statuses filter
  if (approvalStatuses && approvalStatuses.length > 0) {
    whereConditions.push(`fe."approvalStatus" = ANY($${paramIndex})`);
    params.push(approvalStatuses);
    paramIndex++;
  }

  // Search filter (description, transaction ID, vehicle registration)
  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR 
      LOWER(fe."description") LIKE LOWER($${paramIndex}) OR 
      LOWER(fe."transactionId") LIKE LOWER($${paramIndex}) OR
      LOWER(v."registrationNumber") LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Main query for fuel expense records
  const offset = (page - 1) * pageSize;
  const query = `
    SELECT 
      fe."id",
      fe."userId",
      fe."vehicleId",
      fe."cardId",
      fe."fillDate",
      fe."odometerKm",
      fe."fuelLiters",
      fe."fuelAmount",
      fe."pumpMeterReading",
      fe."paymentMode",
      fe."transactionId",
      fe."description",
      fe."transactionType",
      fe."expenseEntryType",
      fe."entrySourceType",
      fe."approvalStatus",
      fe."approvalBy",
      fe."approvalAt",
      fe."approvalReason",
      fe."createdAt",
      fe."updatedAt",
      ${getUserSelectFields('u')},
      ${getUserSelectFields('ab', 'approvalBy')},
      v."registrationNumber",
      v."vehicleType",
      v."vehicleModel",
      c."cardNumber",
      c."cardType",
      LAG(fe."odometerKm") OVER (
        PARTITION BY fe."vehicleId" 
        ORDER BY fe."fillDate" ASC, fe."odometerKm" ASC
      ) as "previousOdometerKm"
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "users" ab ON fe."approvalBy" = ab."id"
    LEFT JOIN "vehicle_master" v ON fe."vehicleId" = v."id"
    LEFT JOIN "cards" c ON fe."cardId" = c."id"
    ${whereClause}
    ORDER BY fe."${sortField}" ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(pageSize, offset);

  // Count query for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "vehicle_master" v ON fe."vehicleId" = v."id"
    ${whereClause}
  `;

  const countParams = params.slice(0, paramIndex - 1); // Remove limit and offset

  return {
    query,
    countQuery,
    params,
    countParams,
  };
};

export const buildFuelExpenseBalanceQuery = (filters: FuelExpenseQueryDto) => {
  const { startDate, endDate, date, userIds, approvalStatuses, search, vehicleId, cardId } =
    filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition
  whereConditions.push(`fe."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Only approved expenses for balance calculations
  whereConditions.push(`fe."approvalStatus" = $${paramIndex}`);
  params.push('approved');
  paramIndex++;

  // Vehicle ID filter
  if (vehicleId) {
    whereConditions.push(`fe."vehicleId" = $${paramIndex}`);
    params.push(vehicleId);
    paramIndex++;
  }

  // Card ID filter
  if (cardId) {
    whereConditions.push(`fe."cardId" = $${paramIndex}`);
    params.push(cardId);
    paramIndex++;
  }

  // User IDs filter
  if (userIds && userIds.length > 0) {
    whereConditions.push(`fe."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  // Search filter (if provided)
  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR 
      LOWER(fe."description") LIKE LOWER($${paramIndex}) OR 
      LOWER(fe."transactionId") LIKE LOWER($${paramIndex}) OR
      LOWER(v."registrationNumber") LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Approval statuses filter
  if (approvalStatuses && approvalStatuses.length > 0) {
    whereConditions.push(`fe."approvalStatus" = ANY($${paramIndex})`);
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
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit"
      FROM "fuel_expenses" fe
      LEFT JOIN "users" u ON fe."userId" = u."id"
      LEFT JOIN "vehicle_master" v ON fe."vehicleId" = v."id"
      WHERE ${baseWhereClause} AND fe."fillDate" < $${openingBalanceParamIndex}
    `;
    openingBalanceParams.push(date);
  } else if (startDate) {
    openingBalanceQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit"
      FROM "fuel_expenses" fe
      LEFT JOIN "users" u ON fe."userId" = u."id"
      LEFT JOIN "vehicle_master" v ON fe."vehicleId" = v."id"
      WHERE ${baseWhereClause} AND fe."fillDate" < $${openingBalanceParamIndex}
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
    periodWhereConditions.push(`DATE(fe."fillDate") = $${periodParamIndex}`);
    periodParams.push(date);
    periodParamIndex++;
  } else {
    if (startDate) {
      periodWhereConditions.push(`fe."fillDate" >= $${periodParamIndex}`);
      periodParams.push(startDate);
      periodParamIndex++;
    }
    if (endDate) {
      periodWhereConditions.push(`fe."fillDate" <= $${periodParamIndex}`);
      periodParams.push(endDate);
      periodParamIndex++;
    }
  }

  const periodWhereClause = periodWhereConditions.join(' AND ');

  const periodTotalsQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "periodCredit",
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "periodDebit"
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "vehicle_master" v ON fe."vehicleId" = v."id"
    WHERE ${periodWhereClause}
  `;

  return {
    openingBalanceQuery,
    openingBalanceParams,
    periodTotalsQuery,
    periodParams,
  };
};

export const buildFuelExpenseSummaryQuery = (filters: FuelExpenseQueryDto) => {
  const { startDate, endDate, date, userIds, approvalStatuses, search, vehicleId, cardId } =
    filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  whereConditions.push(`fe."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  if (date) {
    whereConditions.push(`DATE(fe."fillDate") = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      whereConditions.push(`fe."fillDate" >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`fe."fillDate" <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
  }

  // Vehicle ID filter
  if (vehicleId) {
    whereConditions.push(`fe."vehicleId" = $${paramIndex}`);
    params.push(vehicleId);
    paramIndex++;
  }

  // Card ID filter
  if (cardId) {
    whereConditions.push(`fe."cardId" = $${paramIndex}`);
    params.push(cardId);
    paramIndex++;
  }

  // User IDs filter
  if (userIds && userIds.length > 0) {
    whereConditions.push(`fe."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  // Approval statuses filter
  if (approvalStatuses && approvalStatuses.length > 0) {
    whereConditions.push(`fe."approvalStatus" = ANY($${paramIndex})`);
    params.push(approvalStatuses);
    paramIndex++;
  }

  // Search filter
  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR 
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR 
      LOWER(fe."description") LIKE LOWER($${paramIndex}) OR 
      LOWER(fe."transactionId") LIKE LOWER($${paramIndex}) OR
      LOWER(v."registrationNumber") LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const summaryQuery = `
    SELECT 
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit",
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" ILIKE '%credit%card%' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCreditCardExpense",
      COUNT(*) as "totalRecords",
      COUNT(CASE WHEN fe."approvalStatus" = 'pending' THEN 1 END) as "pendingCount",
      COUNT(CASE WHEN fe."approvalStatus" = 'approved' THEN 1 END) as "approvedCount",
      COUNT(CASE WHEN fe."approvalStatus" = 'rejected' THEN 1 END) as "rejectedCount"
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "vehicle_master" v ON fe."vehicleId" = v."id"
    ${whereClause}
  `;

  return {
    summaryQuery,
    params,
  };
};
