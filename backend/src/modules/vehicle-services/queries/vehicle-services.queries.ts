import { VehicleServiceQueryDto } from '../dto/vehicle-service-query.dto';
import { ServiceAnalyticsQueryDto } from '../dto/service-analytics-query.dto';
import { VehicleServiceStatus, VehicleServiceType } from '../constants/vehicle-services.constants';

export const buildVehicleServiceListQuery = (query: VehicleServiceQueryDto) => {
  const {
    vehicleMasterId,
    serviceType,
    serviceStatus,
    serviceDateFrom,
    serviceDateTo,
    search,
    sortField,
    sortOrder,
    page,
    pageSize,
  } = query;

  const offset = (page - 1) * pageSize;
  const filters: string[] = ['vs."deletedAt" IS NULL'];
  const params: any[] = [];
  let paramIndex = 1;

  if (vehicleMasterId) {
    filters.push(`vs."vehicleMasterId" = $${paramIndex}`);
    params.push(vehicleMasterId);
    paramIndex++;
  }

  if (serviceType) {
    filters.push(`vs."serviceType" = $${paramIndex}`);
    params.push(serviceType);
    paramIndex++;
  }

  if (serviceStatus) {
    filters.push(`vs."serviceStatus" = $${paramIndex}`);
    params.push(serviceStatus);
    paramIndex++;
  }

  if (serviceDateFrom) {
    filters.push(`vs."serviceDate" >= $${paramIndex}`);
    params.push(serviceDateFrom);
    paramIndex++;
  }

  if (serviceDateTo) {
    filters.push(`vs."serviceDate" <= $${paramIndex}`);
    params.push(serviceDateTo);
    paramIndex++;
  }

  if (search) {
    filters.push(`(
      vs."serviceCenterName" ILIKE $${paramIndex} OR
      vs."serviceDetails" ILIKE $${paramIndex} OR
      vs."remarks" ILIKE $${paramIndex} OR
      vm."registrationNo" ILIKE $${paramIndex} OR
      vv."brand" ILIKE $${paramIndex} OR
      vv."model" ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const sortFieldMap: Record<string, string> = {
    createdAt: 'vs."createdAt"',
    updatedAt: 'vs."updatedAt"',
    serviceDate: 'vs."serviceDate"',
    odometerReading: 'vs."odometerReading"',
    serviceCost: 'vs."serviceCost"',
  };

  const orderByColumn = sortFieldMap[sortField || 'serviceDate'] || 'vs."serviceDate"';

  const dataQuery = `
    SELECT 
      vs."id",
      vs."vehicleMasterId",
      vs."serviceDate",
      vs."odometerReading",
      vs."serviceType",
      vs."serviceDetails",
      vs."serviceCenterName",
      vs."serviceCost",
      vs."serviceStatus",
      vs."resetsServiceInterval",
      vs."remarks",
      vs."createdAt",
      vs."updatedAt",
      -- Vehicle details
      json_build_object(
        'id', vm."id",
        'registrationNo', vm."registrationNo",
        'brand', vv."brand",
        'model', vv."model",
        'fuelType', vv."fuelType",
        'status', vv."status"
      ) as "vehicle",
      -- Created by user with employeeId
      json_build_object(
        'id', cb."id",
        'firstName', cb."firstName",
        'lastName', cb."lastName",
        'email', cb."email",
        'employeeId', cb."employeeId"
      ) as "createdByUser",
      -- Service files/docs
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', vsf."id",
              'fileKey', vsf."fileKey",
              'fileType', vsf."fileType",
              'label', vsf."label"
            )
          )
          FROM "vehicle_service_files" vsf
          WHERE vsf."vehicleServiceId" = vs."id" AND vsf."deletedAt" IS NULL
        ),
        '[]'
      ) as "serviceFiles"
    FROM vehicle_services vs
    INNER JOIN vehicle_masters vm ON vm."id" = vs."vehicleMasterId" AND vm."deletedAt" IS NULL
    LEFT JOIN LATERAL (
      SELECT *
      FROM "vehicle_versions"
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) vv ON true
    LEFT JOIN users cb ON cb."id" = vs."createdBy"
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM vehicle_services vs
    INNER JOIN vehicle_masters vm ON vm."id" = vs."vehicleMasterId" AND vm."deletedAt" IS NULL
    LEFT JOIN LATERAL (
      SELECT *
      FROM "vehicle_versions"
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) vv ON true
    ${whereClause}
  `;

  // Stats query - totals for filtered data
  const statsQuery = `
    SELECT 
      COUNT(*)::int as "totalServices",
      COALESCE(SUM(vs."serviceCost"), 0)::decimal as "totalCost",
      COALESCE(AVG(vs."serviceCost"), 0)::decimal as "averageCost",
      COUNT(CASE WHEN vs."serviceStatus" = '${VehicleServiceStatus.PENDING}' THEN 1 END)::int as "pendingCount",
      COUNT(CASE WHEN vs."serviceStatus" = '${VehicleServiceStatus.COMPLETED}' THEN 1 END)::int as "completedCount",
      COUNT(CASE WHEN vs."serviceStatus" = '${VehicleServiceStatus.CANCELLED}' THEN 1 END)::int as "cancelledCount",
      COUNT(CASE WHEN vs."serviceType" = '${VehicleServiceType.REGULAR_SERVICE}' THEN 1 END)::int as "regularServiceCount",
      COUNT(CASE WHEN vs."serviceType" = '${VehicleServiceType.EMERGENCY_SERVICE}' THEN 1 END)::int as "emergencyServiceCount",
      COUNT(CASE WHEN vs."serviceType" = '${VehicleServiceType.BREAKDOWN_REPAIR}' THEN 1 END)::int as "breakdownRepairCount",
      COUNT(CASE WHEN vs."serviceType" = '${VehicleServiceType.ACCIDENT_REPAIR}' THEN 1 END)::int as "accidentRepairCount",
      COUNT(CASE WHEN vs."serviceType" = '${VehicleServiceType.TYRE_CHANGE}' THEN 1 END)::int as "tyreChangeCount",
      COUNT(CASE WHEN vs."serviceType" = '${VehicleServiceType.BATTERY_REPLACEMENT}' THEN 1 END)::int as "batteryReplacementCount",
      COUNT(CASE WHEN vs."serviceType" = '${VehicleServiceType.OTHER}' THEN 1 END)::int as "otherCount"
    FROM vehicle_services vs
    INNER JOIN vehicle_masters vm ON vm."id" = vs."vehicleMasterId" AND vm."deletedAt" IS NULL
    LEFT JOIN LATERAL (
      SELECT *
      FROM "vehicle_versions"
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) vv ON true
    ${whereClause}
  `;

  params.push(pageSize, offset);

  return { dataQuery, countQuery, statsQuery, params };
};

export const buildServiceAnalyticsQuery = (query: ServiceAnalyticsQueryDto) => {
  const { vehicleMasterId, fromDate, toDate } = query;

  const filters: string[] = [
    'vs."deletedAt" IS NULL',
    `vs."serviceStatus" = '${VehicleServiceStatus.COMPLETED}'`,
  ];
  const params: any[] = [];
  let paramIndex = 1;

  if (vehicleMasterId) {
    filters.push(`vs."vehicleMasterId" = $${paramIndex}`);
    params.push(vehicleMasterId);
    paramIndex++;
  }

  if (fromDate) {
    filters.push(`vs."serviceDate" >= $${paramIndex}`);
    params.push(fromDate);
    paramIndex++;
  }

  if (toDate) {
    filters.push(`vs."serviceDate" <= $${paramIndex}`);
    params.push(toDate);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  // Overall summary
  const summaryQuery = `
    SELECT 
      COUNT(*)::int as "totalServices",
      COALESCE(SUM(vs."serviceCost"), 0)::decimal as "totalCost",
      COALESCE(AVG(vs."serviceCost"), 0)::decimal as "averageCost",
      MAX(vs."odometerReading")::int as "maxOdometer",
      MIN(vs."odometerReading")::int as "minOdometer"
    FROM vehicle_services vs
    ${whereClause}
  `;

  // Cost by service type
  const costByTypeQuery = `
    SELECT 
      vs."serviceType",
      COUNT(*)::int as "count",
      COALESCE(SUM(vs."serviceCost"), 0)::decimal as "totalCost",
      COALESCE(AVG(vs."serviceCost"), 0)::decimal as "averageCost"
    FROM vehicle_services vs
    ${whereClause}
    GROUP BY vs."serviceType"
    ORDER BY "totalCost" DESC
  `;

  // Monthly breakdown
  const monthlyQuery = `
    SELECT 
      TO_CHAR(vs."serviceDate", 'YYYY-MM') as "month",
      COUNT(*)::int as "serviceCount",
      COALESCE(SUM(vs."serviceCost"), 0)::decimal as "totalCost"
    FROM vehicle_services vs
    ${whereClause}
    GROUP BY TO_CHAR(vs."serviceDate", 'YYYY-MM')
    ORDER BY "month" DESC
  `;

  // Cost per km calculation (for vehicle-specific analytics)
  const costPerKmQuery = vehicleMasterId
    ? `
    SELECT 
      CASE 
        WHEN (MAX(vs."odometerReading") - MIN(vs."odometerReading")) > 0 
        THEN COALESCE(SUM(vs."serviceCost"), 0) / (MAX(vs."odometerReading") - MIN(vs."odometerReading"))
        ELSE 0
      END as "costPerKm"
    FROM vehicle_services vs
    ${whereClause}
  `
    : null;

  return {
    summaryQuery,
    costByTypeQuery,
    monthlyQuery,
    costPerKmQuery,
    params,
  };
};

export const buildLatestServiceQuery = (vehicleMasterId: string) => {
  return {
    query: `
      SELECT 
        vs."id",
        vs."serviceDate",
        vs."odometerReading",
        vs."serviceType",
        vs."resetsServiceInterval"
      FROM vehicle_services vs
      WHERE vs."vehicleMasterId" = $1
        AND vs."deletedAt" IS NULL
        AND vs."serviceStatus" = '${VehicleServiceStatus.COMPLETED}'
        AND vs."resetsServiceInterval" = true
      ORDER BY vs."serviceDate" DESC, vs."odometerReading" DESC
      LIMIT 1
    `,
    params: [vehicleMasterId],
  };
};

export const buildLatestOdometerQuery = (vehicleMasterId: string) => {
  return {
    query: `
      SELECT MAX(odometer) as "latestOdometer"
      FROM (
        SELECT vs."odometerReading" as odometer
        FROM vehicle_services vs
        WHERE vs."vehicleMasterId" = $1 AND vs."deletedAt" IS NULL
        UNION ALL
        SELECT fe."odometerReading" as odometer
        FROM fuel_expenses fe
        WHERE fe."vehicleId" = $1 AND fe."deletedAt" IS NULL
      ) combined
    `,
    params: [vehicleMasterId],
  };
};

export const buildVehiclesServiceStatusQuery = () => {
  return {
    query: `
      SELECT 
        vm."id",
        vm."registrationNo",
        vv."brand",
        vv."model",
        vv."lastServiceKm",
        vv."lastServiceDate",
        latest_odometer."latestOdometer" as "currentOdometerKm"
      FROM vehicle_masters vm
      INNER JOIN vehicle_versions vv ON vv."vehicleMasterId" = vm."id" AND vv."isActive" = true
      LEFT JOIN LATERAL (
        SELECT MAX(odometer) as "latestOdometer"
        FROM (
          SELECT vs."odometerReading" as odometer
          FROM vehicle_services vs
          WHERE vs."vehicleMasterId" = vm."id" AND vs."deletedAt" IS NULL
          UNION ALL
          SELECT fe."odometerReading" as odometer
          FROM fuel_expenses fe
          WHERE fe."vehicleId" = vm."id" AND fe."deletedAt" IS NULL
        ) combined
      ) latest_odometer ON true
      WHERE vm."deletedAt" IS NULL AND vv."deletedAt" IS NULL
    `,
    params: [],
  };
};
