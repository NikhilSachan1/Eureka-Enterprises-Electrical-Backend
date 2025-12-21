import { VehicleQueryDto } from '../dto/vehicle-query.dto';

export const getVehicleQuery = (query: VehicleQueryDto) => {
  const {
    registrationNo,
    brand,
    model,
    mileage,
    fuelType,
    status,
    assignedTo,
    search,
    sortField,
    sortOrder,
    page,
    pageSize,
  } = query;

  const offset = (page - 1) * pageSize;
  const filters: string[] = ['vm."deletedAt" IS NULL', 'vv."isActive" = true'];
  const params: any[] = [];
  let paramIndex = 1;

  // Add filters
  if (registrationNo) {
    filters.push(`vm."registrationNo" ILIKE $${paramIndex}`);
    params.push(`%${registrationNo}%`);
    paramIndex++;
  }

  if (brand) {
    filters.push(`vv."brand" ILIKE $${paramIndex}`);
    params.push(`%${brand}%`);
    paramIndex++;
  }

  if (model) {
    filters.push(`vv."model" ILIKE $${paramIndex}`);
    params.push(`%${model}%`);
    paramIndex++;
  }

  if (mileage) {
    filters.push(`vv."mileage" ILIKE $${paramIndex}`);
    params.push(`%${mileage}%`);
    paramIndex++;
  }

  if (fuelType) {
    filters.push(`vv."fuelType" = $${paramIndex}`);
    params.push(fuelType);
    paramIndex++;
  }

  if (status) {
    filters.push(`vv."status" = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (assignedTo) {
    filters.push(`vv."assignedTo" = $${paramIndex}`);
    params.push(assignedTo);
    paramIndex++;
  }

  // General search across multiple fields
  if (search) {
    filters.push(`(
      vm."registrationNo" ILIKE $${paramIndex} OR
      vv."number" ILIKE $${paramIndex} OR
      vv."brand" ILIKE $${paramIndex} OR
      vv."model" ILIKE $${paramIndex} OR
      vv."dealerName" ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  // Map sortField to correct table column
  const sortFieldMap: Record<string, string> = {
    createdAt: 'vm."createdAt"',
    updatedAt: 'vm."updatedAt"',
    deletedAt: 'vm."deletedAt"',
    number: 'vv."number"',
    brand: 'vv."brand"',
    model: 'vv."model"',
    mileage: 'vv."mileage"',
    fuelType: 'vv."fuelType"',
    status: 'vv."status"',
    purchaseDate: 'vv."purchaseDate"',
    insuranceEndDate: 'vv."insuranceEndDate"',
    pucEndDate: 'vv."pucEndDate"',
    fitnessEndDate: 'vv."fitnessEndDate"',
  };

  const orderByColumn = sortFieldMap[sortField || 'createdAt'] || 'vm."createdAt"';

  const dataQuery = `
    SELECT 
      vm."id",
      vm."registrationNo",
      vm."createdAt",
      vm."updatedAt",
      vm."deletedAt",
      vv."number",
      vv."brand",
      vv."model",
      vv."mileage",
      vv."fuelType",
      vv."purchaseDate",
      vv."dealerName",
      vv."insuranceStartDate",
      vv."insuranceEndDate",
      vv."pucStartDate",
      vv."pucEndDate",
      vv."fitnessStartDate",
      vv."fitnessEndDate",
      vv."status",
      vv."assignedTo",
      vv."remarks",
      vv."additionalData",
      vv."vehicleMasterId",
      CASE 
        WHEN vv."assignedTo" IS NOT NULL THEN json_build_object(
          'id', u."id",
          'firstName', u."firstName",
          'lastName', u."lastName",
          'email', u."email",
          'employeeId', u."employeeId"
        )
        ELSE NULL
      END as "assignedToUser"
    FROM vehicle_masters vm
    INNER JOIN LATERAL (
      SELECT *
      FROM vehicle_versions
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) vv ON true
    LEFT JOIN users u ON u."id" = vv."assignedTo" AND u."deletedAt" IS NULL
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT vm."id")::int as total
    FROM vehicle_masters vm
    INNER JOIN LATERAL (
      SELECT "vehicleMasterId", "fuelType", "status", "assignedTo", "number", "brand", "model", "mileage", "dealerName"
      FROM vehicle_versions
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) vv ON true
    ${whereClause}
  `;

  params.push(pageSize, offset);

  return {
    dataQuery,
    countQuery,
    params,
  };
};
