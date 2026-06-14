import { FuelExpenseQueryDto } from '../dto/fuel-expense-query.dto';
import { FuelPendingSettlementQueryDto } from '../dto/pending-settlement-query.dto';
import { TransactionType } from '../constants/fuel-expense.constants';
import { getUserSelectFields } from 'src/utils/utility/utility.service';

export const buildFuelExpenseListQuery = (filters: FuelExpenseQueryDto) => {
  const {
    startDate,
    endDate,
    date,
    userIds,
    approvalStatuses,
    paymentModes,
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

  // Payment modes filter
  if (paymentModes && paymentModes.length > 0) {
    whereConditions.push(`fe."paymentMode" = ANY($${paramIndex})`);
    params.push(paymentModes);
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
      LOWER(v."registrationNo") LIKE LOWER($${paramIndex}) OR
      CAST(fe."fuelAmount" AS TEXT) LIKE $${paramIndex}
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
      fe."createdBy",
      fe."createdAt",
      fe."updatedAt",
      ${getUserSelectFields('u')},
      ${getUserSelectFields('cb', 'createdBy')},
      ${getUserSelectFields('ab', 'approvalBy')},
      v."registrationNo" as "registrationNumber",
      vv."brand" as "vehicleBrand",
      vv."model" as "vehicleModel",
      vv."fuelType" as "vehicleFuelType",
      vv."mileage" as "vehicleMileage",
      vv."status" as "vehicleStatus",
      c."cardNumber",
      c."cardType",
      LAG(fe."odometerKm") OVER (
        PARTITION BY fe."vehicleId" 
        ORDER BY fe."fillDate" ASC, fe."odometerKm" ASC
      ) as "previousOdometerKm",
      LAG(fe."fuelLiters") OVER (
        PARTITION BY fe."vehicleId" 
        ORDER BY fe."fillDate" ASC, fe."odometerKm" ASC
      ) as "previousFuelLiters",
      LAG(fe."odometerKm", 2) OVER (
        PARTITION BY fe."vehicleId" 
        ORDER BY fe."fillDate" ASC, fe."odometerKm" ASC
      ) as "secondPreviousOdometerKm"
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "users" cb ON fe."createdBy" = cb."id"
    LEFT JOIN "users" ab ON fe."approvalBy" = ab."id"
    LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
    LEFT JOIN "vehicle_versions" vv ON v."id" = vv."vehicleMasterId" AND vv."isActive" = true
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
    LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
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
  const { startDate, endDate, date, userIds, paymentModes, search, vehicleId, cardId } = filters;

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
      LOWER(v."registrationNo") LIKE LOWER($${paramIndex}) OR
      CAST(fe."fuelAmount" AS TEXT) LIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Payment modes filter
  if (paymentModes && paymentModes.length > 0) {
    whereConditions.push(`fe."paymentMode" = ANY($${paramIndex})`);
    params.push(paymentModes);
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
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit"
      FROM "fuel_expenses" fe
      LEFT JOIN "users" u ON fe."userId" = u."id"
      LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
      WHERE ${baseWhereClause} AND fe."fillDate" < $${openingBalanceParamIndex}
    `;
    openingBalanceParams.push(date);
  } else if (startDate) {
    openingBalanceQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit"
      FROM "fuel_expenses" fe
      LEFT JOIN "users" u ON fe."userId" = u."id"
      LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
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
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "periodCredit",
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "periodDebit"
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
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
 * Projected balance query — same as balance query but includes both 'approved' AND 'pending' fuel expenses.
 */
export const buildProjectedFuelBalanceQuery = (filters: FuelExpenseQueryDto) => {
  const { startDate, endDate, date, userIds, paymentModes, search, vehicleId, cardId } = filters;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  whereConditions.push(`fe."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Include both approved and pending
  whereConditions.push(`fe."approvalStatus" = ANY($${paramIndex})`);
  params.push(['approved', 'pending']);
  paramIndex++;

  if (vehicleId) {
    whereConditions.push(`fe."vehicleId" = $${paramIndex}`);
    params.push(vehicleId);
    paramIndex++;
  }

  if (cardId) {
    whereConditions.push(`fe."cardId" = $${paramIndex}`);
    params.push(cardId);
    paramIndex++;
  }

  if (userIds && userIds.length > 0) {
    whereConditions.push(`fe."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  if (search) {
    whereConditions.push(`(
      LOWER(u."firstName") LIKE LOWER($${paramIndex}) OR
      LOWER(u."lastName") LIKE LOWER($${paramIndex}) OR
      LOWER(u."email") LIKE LOWER($${paramIndex}) OR
      LOWER(fe."description") LIKE LOWER($${paramIndex}) OR
      LOWER(fe."transactionId") LIKE LOWER($${paramIndex}) OR
      LOWER(v."registrationNo") LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (paymentModes && paymentModes.length > 0) {
    whereConditions.push(`fe."paymentMode" = ANY($${paramIndex})`);
    params.push(paymentModes);
    paramIndex++;
  }

  const baseWhereClause = whereConditions.join(' AND ');

  let openingBalanceQuery = '';
  let openingBalanceParams = [...params];
  const openingBalanceParamIndex = paramIndex;

  if (date) {
    openingBalanceQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit"
      FROM "fuel_expenses" fe
      LEFT JOIN "users" u ON fe."userId" = u."id"
      LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
      WHERE ${baseWhereClause} AND fe."fillDate" < $${openingBalanceParamIndex}
    `;
    openingBalanceParams.push(date);
  } else if (startDate) {
    openingBalanceQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
        COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit"
      FROM "fuel_expenses" fe
      LEFT JOIN "users" u ON fe."userId" = u."id"
      LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
      WHERE ${baseWhereClause} AND fe."fillDate" < $${openingBalanceParamIndex}
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
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "periodCredit",
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "periodDebit"
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
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
  const { startDate, endDate, date, userIds, paymentModes, search, vehicleId, cardId } = filters;

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

  // Payment modes filter
  if (paymentModes && paymentModes.length > 0) {
    whereConditions.push(`fe."paymentMode" = ANY($${paramIndex})`);
    params.push(paymentModes);
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
      LOWER(v."registrationNo") LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const summaryQuery = `
    SELECT
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalCredit",
      COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."paymentMode" <> '${TransactionType.PETRO_CARD}' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalDebit",
      COALESCE(SUM(CASE WHEN fe."paymentMode" = '${TransactionType.PETRO_CARD}' AND fe."approvalStatus" <> 'rejected' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalPetroCardExpense",
      COALESCE(SUM(CASE WHEN fe."paymentMode" = '${TransactionType.PETRO_CARD}' AND fe."approvalStatus" = 'approved' THEN fe."fuelAmount" ELSE 0 END), 0) as "totalPetroCardDebitApproved",
      COUNT(*) as "totalRecords",
      COUNT(CASE WHEN fe."approvalStatus" = 'pending' THEN 1 END) as "pendingCount",
      COUNT(CASE WHEN fe."approvalStatus" = 'approved' THEN 1 END) as "approvedCount",
      COUNT(CASE WHEN fe."approvalStatus" = 'rejected' THEN 1 END) as "rejectedCount"
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
    LEFT JOIN "vehicle_masters" v ON fe."vehicleId" = v."id"
    ${whereClause}
  `;

  return {
    summaryQuery,
    params,
  };
};

export const buildFuelPendingSettlementQuery = (filters: FuelPendingSettlementQueryDto) => {
  const { startDate, endDate, userIds, page = 1, pageSize, sortOrder = 'DESC' } = filters;

  const whereConditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  whereConditions.push(`fe."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  if (userIds && userIds.length > 0) {
    whereConditions.push(`fe."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

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

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const approvedDebitExpr = `COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.DEBIT}' AND fe."approvalStatus" = 'approved' THEN fe."fuelAmount"::numeric ELSE 0 END), 0)`;
  const settledExpr = `COALESCE(SUM(CASE WHEN fe."transactionType" = '${TransactionType.CREDIT}' THEN fe."fuelAmount"::numeric ELSE 0 END), 0)`;

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
    FROM "fuel_expenses" fe
    LEFT JOIN "users" u ON fe."userId" = u."id"
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
