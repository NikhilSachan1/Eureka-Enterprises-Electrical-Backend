import { VehicleQueryDto } from '../dto/vehicle-query.dto';
import {
  VehicleStatus,
  VehicleFuelType,
  DEFAULT_EXPIRING_SOON_DAYS,
} from '../constants/vehicle-masters.constants';

export const getVehicleStatsQuery = () => {
  return `
    SELECT
      -- Total count
      COUNT(DISTINCT vm."id") as "total",
      
      -- Status breakdown
      COUNT(DISTINCT CASE WHEN vv."status" = '${VehicleStatus.AVAILABLE}' THEN vm."id" END) as "available",
      COUNT(DISTINCT CASE WHEN vv."status" = '${VehicleStatus.ASSIGNED}' THEN vm."id" END) as "assigned",
      COUNT(DISTINCT CASE WHEN vv."status" = '${VehicleStatus.UNDER_MAINTENANCE}' THEN vm."id" END) as "underMaintenance",
      COUNT(DISTINCT CASE WHEN vv."status" = '${VehicleStatus.DAMAGED}' THEN vm."id" END) as "damaged",
      COUNT(DISTINCT CASE WHEN vv."status" = '${VehicleStatus.RETIRED}' THEN vm."id" END) as "retired",
      
      -- Fuel type breakdown
      COUNT(DISTINCT CASE WHEN vv."fuelType" = '${VehicleFuelType.PETROL}' THEN vm."id" END) as "petrol",
      COUNT(DISTINCT CASE WHEN vv."fuelType" = '${VehicleFuelType.DIESEL}' THEN vm."id" END) as "diesel",
      COUNT(DISTINCT CASE WHEN vv."fuelType" = '${VehicleFuelType.CNG}' THEN vm."id" END) as "cng",
      COUNT(DISTINCT CASE WHEN vv."fuelType" = '${VehicleFuelType.ELECTRIC}' THEN vm."id" END) as "electric",
      COUNT(DISTINCT CASE WHEN vv."fuelType" = '${VehicleFuelType.HYBRID}' THEN vm."id" END) as "hybrid",
      
      -- Insurance status breakdown
      COUNT(DISTINCT CASE 
        WHEN vv."insuranceEndDate" IS NOT NULL 
        AND vv."insuranceEndDate" < NOW() 
        THEN vm."id" 
      END) as "insuranceExpired",
      COUNT(DISTINCT CASE 
        WHEN vv."insuranceEndDate" IS NOT NULL 
        AND vv."insuranceEndDate" >= NOW() 
        AND vv."insuranceEndDate" <= NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days'
        THEN vm."id" 
      END) as "insuranceExpiringSoon",
      COUNT(DISTINCT CASE 
        WHEN vv."insuranceEndDate" IS NOT NULL 
        AND vv."insuranceEndDate" > NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days'
        THEN vm."id" 
      END) as "insuranceActive",
      COUNT(DISTINCT CASE 
        WHEN vv."insuranceEndDate" IS NULL 
        THEN vm."id" 
      END) as "insuranceNotApplicable",
      
      -- PUC status breakdown
      COUNT(DISTINCT CASE 
        WHEN vv."pucEndDate" IS NOT NULL 
        AND vv."pucEndDate" < NOW() 
        THEN vm."id" 
      END) as "pucExpired",
      COUNT(DISTINCT CASE 
        WHEN vv."pucEndDate" IS NOT NULL 
        AND vv."pucEndDate" >= NOW() 
        AND vv."pucEndDate" <= NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days'
        THEN vm."id" 
      END) as "pucExpiringSoon",
      COUNT(DISTINCT CASE 
        WHEN vv."pucEndDate" IS NOT NULL 
        AND vv."pucEndDate" > NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days'
        THEN vm."id" 
      END) as "pucActive",
      COUNT(DISTINCT CASE 
        WHEN vv."pucEndDate" IS NULL 
        THEN vm."id" 
      END) as "pucNotApplicable",
      
      -- Fitness status breakdown
      COUNT(DISTINCT CASE 
        WHEN vv."fitnessEndDate" IS NOT NULL 
        AND vv."fitnessEndDate" < NOW() 
        THEN vm."id" 
      END) as "fitnessExpired",
      COUNT(DISTINCT CASE 
        WHEN vv."fitnessEndDate" IS NOT NULL 
        AND vv."fitnessEndDate" >= NOW() 
        AND vv."fitnessEndDate" <= NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days'
        THEN vm."id" 
      END) as "fitnessExpiringSoon",
      COUNT(DISTINCT CASE 
        WHEN vv."fitnessEndDate" IS NOT NULL 
        AND vv."fitnessEndDate" > NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days'
        THEN vm."id" 
      END) as "fitnessActive",
      COUNT(DISTINCT CASE 
        WHEN vv."fitnessEndDate" IS NULL 
        THEN vm."id" 
      END) as "fitnessNotApplicable"
      
    FROM "vehicle_masters" vm
    INNER JOIN LATERAL (
      SELECT *
      FROM "vehicle_versions"
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) vv ON true
    WHERE vm."deletedAt" IS NULL
  `;
};

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
  const filters: string[] = ['vm."deletedAt" IS NULL'];
  const params: any[] = [];
  let paramIndex = 1;

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
      vm."cardId",
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
      vv."lastServiceKm",
      vv."lastServiceDate",
      CASE 
        WHEN vv."assignedTo" IS NOT NULL THEN json_build_object(
          'id', u."id",
          'firstName', u."firstName",
          'lastName', u."lastName",
          'email', u."email",
          'employeeId', u."employeeId"
        )
        ELSE NULL
      END as "assignedToUser",
      -- Get current odometer reading from fuel_expenses or vehicle_services
      COALESCE(
        (SELECT MAX("odometerKm") FROM fuel_expenses WHERE "vehicleMasterId" = vm."id" AND "deletedAt" IS NULL),
        (SELECT MAX("odometerReading") FROM vehicle_services WHERE "vehicleMasterId" = vm."id" AND "deletedAt" IS NULL),
        0
      ) as "currentOdometerKm"
    FROM "vehicle_masters" vm
    INNER JOIN LATERAL (
      SELECT *
      FROM "vehicle_versions"
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
    FROM "vehicle_masters" vm
    INNER JOIN LATERAL (
      SELECT *
      FROM "vehicle_versions"
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) vv ON true
    ${whereClause}
  `;

  const countParams = [...params];

  params.push(pageSize, offset);

  return {
    dataQuery,
    countQuery,
    params,
    countParams,
  };
};
