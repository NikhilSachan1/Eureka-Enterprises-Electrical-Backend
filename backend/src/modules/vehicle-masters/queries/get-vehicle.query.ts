import { VehicleQueryDto } from '../dto/vehicle-query.dto';
import {
  VehicleStatus,
  VehicleFuelType,
  VehicleFileTypes,
  DEFAULT_EXPIRING_SOON_DAYS,
  DocumentStatus,
  ServiceDueStatus,
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
    fuelTypes,
    statuses,
    insuranceStatuses,
    pucStatuses,
    fitnessStatuses,
    serviceDueStatuses,
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

  if (fuelTypes && fuelTypes.length > 0) {
    filters.push(`vv."fuelType" = ANY($${paramIndex})`);
    params.push(fuelTypes);
    paramIndex++;
  }

  if (statuses && statuses.length > 0) {
    filters.push(`vv."status" = ANY($${paramIndex})`);
    params.push(statuses);
    paramIndex++;
  }

  // Computed status filters for insurance
  if (insuranceStatuses && insuranceStatuses.length > 0) {
    const insuranceConditions: string[] = [];
    insuranceStatuses.forEach((status) => {
      if (status === DocumentStatus.ACTIVE) {
        insuranceConditions.push(
          `(vv."insuranceEndDate" IS NOT NULL AND vv."insuranceEndDate" > NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days')`,
        );
      } else if (status === DocumentStatus.EXPIRING_SOON) {
        insuranceConditions.push(
          `(vv."insuranceEndDate" IS NOT NULL AND vv."insuranceEndDate" >= NOW() AND vv."insuranceEndDate" <= NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days')`,
        );
      } else if (status === DocumentStatus.EXPIRED) {
        insuranceConditions.push(
          `(vv."insuranceEndDate" IS NOT NULL AND vv."insuranceEndDate" < NOW())`,
        );
      } else if (status === DocumentStatus.NOT_APPLICABLE) {
        insuranceConditions.push(`(vv."insuranceEndDate" IS NULL)`);
      }
    });
    if (insuranceConditions.length > 0) {
      filters.push(`(${insuranceConditions.join(' OR ')})`);
    }
  }

  // Computed status filters for PUC
  if (pucStatuses && pucStatuses.length > 0) {
    const pucConditions: string[] = [];
    pucStatuses.forEach((status) => {
      if (status === DocumentStatus.ACTIVE) {
        pucConditions.push(
          `(vv."pucEndDate" IS NOT NULL AND vv."pucEndDate" > NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days')`,
        );
      } else if (status === DocumentStatus.EXPIRING_SOON) {
        pucConditions.push(
          `(vv."pucEndDate" IS NOT NULL AND vv."pucEndDate" >= NOW() AND vv."pucEndDate" <= NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days')`,
        );
      } else if (status === DocumentStatus.EXPIRED) {
        pucConditions.push(`(vv."pucEndDate" IS NOT NULL AND vv."pucEndDate" < NOW())`);
      } else if (status === DocumentStatus.NOT_APPLICABLE) {
        pucConditions.push(`(vv."pucEndDate" IS NULL)`);
      }
    });
    if (pucConditions.length > 0) {
      filters.push(`(${pucConditions.join(' OR ')})`);
    }
  }

  // Computed status filters for fitness
  if (fitnessStatuses && fitnessStatuses.length > 0) {
    const fitnessConditions: string[] = [];
    fitnessStatuses.forEach((status) => {
      if (status === DocumentStatus.ACTIVE) {
        fitnessConditions.push(
          `(vv."fitnessEndDate" IS NOT NULL AND vv."fitnessEndDate" > NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days')`,
        );
      } else if (status === DocumentStatus.EXPIRING_SOON) {
        fitnessConditions.push(
          `(vv."fitnessEndDate" IS NOT NULL AND vv."fitnessEndDate" >= NOW() AND vv."fitnessEndDate" <= NOW() + INTERVAL '${DEFAULT_EXPIRING_SOON_DAYS} days')`,
        );
      } else if (status === DocumentStatus.EXPIRED) {
        fitnessConditions.push(`(vv."fitnessEndDate" IS NOT NULL AND vv."fitnessEndDate" < NOW())`);
      } else if (status === DocumentStatus.NOT_APPLICABLE) {
        fitnessConditions.push(`(vv."fitnessEndDate" IS NULL)`);
      }
    });
    if (fitnessConditions.length > 0) {
      filters.push(`(${fitnessConditions.join(' OR ')})`);
    }
  }

  // Computed status filters for service due (based on lastServiceDate and lastServiceKm)
  if (serviceDueStatuses && serviceDueStatuses.length > 0) {
    const serviceConditions: string[] = [];
    serviceDueStatuses.forEach((status) => {
      if (status === ServiceDueStatus.OK) {
        // Service is OK if last service was within acceptable range
        serviceConditions.push(
          `(vv."lastServiceDate" IS NOT NULL AND vv."lastServiceDate" > NOW() - INTERVAL '6 months')`,
        );
      } else if (status === ServiceDueStatus.DUE_SOON) {
        // Service is due soon if last service was 5-6 months ago
        serviceConditions.push(
          `(vv."lastServiceDate" IS NOT NULL AND vv."lastServiceDate" <= NOW() - INTERVAL '5 months' AND vv."lastServiceDate" > NOW() - INTERVAL '6 months')`,
        );
      } else if (status === ServiceDueStatus.OVERDUE) {
        // Service is overdue if last service was more than 6 months ago or never done
        serviceConditions.push(
          `(vv."lastServiceDate" IS NULL OR vv."lastServiceDate" <= NOW() - INTERVAL '6 months')`,
        );
      }
    });
    if (serviceConditions.length > 0) {
      filters.push(`(${serviceConditions.join(' OR ')})`);
    }
  }

  if (assignedTo) {
    filters.push(`vv."assignedTo" = $${paramIndex}`);
    params.push(assignedTo);
    paramIndex++;
  }

  if (search) {
    filters.push(`(
      vm."registrationNo" ILIKE $${paramIndex} OR
      vv."registrationNo" ILIKE $${paramIndex} OR
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
    registrationNo: 'vv."registrationNo"',
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
      vv."registrationNo",
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
      ) as "currentOdometerKm",
      -- Get files for active version
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', vf."id",
              'fileKey', vf."fileKey",
              'fileType', vf."fileType",
              'label', vf."label"
            )
          )
          FROM "vehicles_files" vf
          WHERE vf."vehicleVersionId" = vv."id"
            AND vf."fileType" = '${VehicleFileTypes.VEHICLE_IMAGE}'
            AND vf."deletedAt" IS NULL
        ),
        '[]'::json
      ) as "files",
      -- Associated card details
      CASE 
        WHEN c."id" IS NOT NULL THEN json_build_object(
          'id', c."id",
          'cardNumber', c."cardNumber",
          'cardType', c."cardType",
          'cardName', c."cardName",
          'holderName', c."holderName",
          'expiryDate', c."expiryDate",
          'expiryStatus', c."expiryStatus"
        )
        ELSE NULL
      END as "associatedCard"
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
    LEFT JOIN cards c ON c."id" = vm."cardId" AND c."deletedAt" IS NULL
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
