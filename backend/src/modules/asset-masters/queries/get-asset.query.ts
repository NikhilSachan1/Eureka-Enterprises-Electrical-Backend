import { AssetQueryDto } from '../dto/asset-query.dto';
import {
  ASSET_SORT_FIELD_MAPPING,
  AssetType,
  AssetStatus,
  CalibrationStatus,
  WarrantyStatus,
  EXPIRING_SOON_DAYS,
} from '../constants/asset-masters.constants';

export const getAssetStatsQuery = () => {
  return `
    SELECT
      -- Total count
      COUNT(DISTINCT am."id") as "total",
      
      -- Status breakdown
      COUNT(DISTINCT CASE WHEN av."status" = '${AssetStatus.AVAILABLE}' THEN am."id" END) as "available",
      COUNT(DISTINCT CASE WHEN av."status" = '${AssetStatus.ASSIGNED}' THEN am."id" END) as "assigned",
      COUNT(DISTINCT CASE WHEN av."status" = '${AssetStatus.UNDER_MAINTENANCE}' THEN am."id" END) as "underMaintenance",
      COUNT(DISTINCT CASE WHEN av."status" = '${AssetStatus.DAMAGED}' THEN am."id" END) as "damaged",
      COUNT(DISTINCT CASE WHEN av."status" = '${AssetStatus.RETIRED}' THEN am."id" END) as "retired",
      
      -- Asset type breakdown
      COUNT(DISTINCT CASE WHEN av."assetType" = '${AssetType.CALIBRATED}' THEN am."id" END) as "calibrated",
      COUNT(DISTINCT CASE WHEN av."assetType" = '${AssetType.NON_CALIBRATED}' THEN am."id" END) as "nonCalibrated",
      
      -- Calibration status breakdown (only for calibrated assets)
      COUNT(DISTINCT CASE 
        WHEN av."assetType" = '${AssetType.CALIBRATED}' 
        AND av."calibrationEndDate" < NOW() 
        THEN am."id" 
      END) as "calibrationExpired",
      COUNT(DISTINCT CASE 
        WHEN av."assetType" = '${AssetType.CALIBRATED}' 
        AND av."calibrationEndDate" >= NOW() 
        AND av."calibrationEndDate" <= NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
        THEN am."id" 
      END) as "calibrationExpiringSoon",
      COUNT(DISTINCT CASE 
        WHEN av."assetType" = '${AssetType.CALIBRATED}' 
        AND av."calibrationEndDate" > NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
        THEN am."id" 
      END) as "calibrationValid",
      
      -- Warranty status breakdown
      COUNT(DISTINCT CASE 
        WHEN av."warrantyEndDate" IS NOT NULL 
        AND av."warrantyEndDate" < NOW() 
        THEN am."id" 
      END) as "warrantyExpired",
      COUNT(DISTINCT CASE 
        WHEN av."warrantyEndDate" IS NOT NULL 
        AND av."warrantyEndDate" >= NOW() 
        AND av."warrantyEndDate" <= NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
        THEN am."id" 
      END) as "warrantyExpiringSoon",
      COUNT(DISTINCT CASE 
        WHEN av."warrantyEndDate" IS NOT NULL 
        AND av."warrantyEndDate" > NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
        THEN am."id" 
      END) as "warrantyValid",
      COUNT(DISTINCT CASE 
        WHEN av."warrantyEndDate" IS NULL 
        THEN am."id" 
      END) as "warrantyNotApplicable"
      
    FROM "asset_masters" am
    INNER JOIN LATERAL (
      SELECT *
      FROM "asset_versions"
      WHERE "assetMasterId" = am."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) av ON true
    WHERE am."deletedAt" IS NULL
  `;
};

export const getAssetQuery = (query: AssetQueryDto) => {
  const {
    assetId,
    name,
    model,
    serialNumber,
    category,
    assetType,
    status,
    calibrationStatus,
    warrantyStatus,
    assignedTo,
    search,
    sortField,
    sortOrder,
    page,
    pageSize,
  } = query;

  const offset = (page - 1) * pageSize;
  const filters: string[] = ['am."deletedAt" IS NULL'];
  const params: any[] = [];
  let paramIndex = 1;

  // Add filters
  if (assetId) {
    filters.push(`am."assetId" ILIKE $${paramIndex}`);
    params.push(`%${assetId}%`);
    paramIndex++;
  }

  if (name) {
    filters.push(`av."name" ILIKE $${paramIndex}`);
    params.push(`%${name}%`);
    paramIndex++;
  }

  if (model) {
    filters.push(`av."model" ILIKE $${paramIndex}`);
    params.push(`%${model}%`);
    paramIndex++;
  }

  if (serialNumber) {
    filters.push(`av."serialNumber" ILIKE $${paramIndex}`);
    params.push(`%${serialNumber}%`);
    paramIndex++;
  }

  if (category) {
    filters.push(`av."category" = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (assetType) {
    filters.push(`av."assetType" = $${paramIndex}`);
    params.push(assetType);
    paramIndex++;
  }

  if (status) {
    filters.push(`av."status" = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (assignedTo) {
    filters.push(`av."assignedTo" = $${paramIndex}`);
    params.push(assignedTo);
    paramIndex++;
  }

  // General search across multiple fields
  if (search) {
    filters.push(`(
      am."assetId" ILIKE $${paramIndex}
      OR av."name" ILIKE $${paramIndex}
      OR av."serialNumber" ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Calibration status filter (computed)
  if (calibrationStatus) {
    if (calibrationStatus === CalibrationStatus.NOT_APPLICABLE) {
      filters.push(`(av."assetType" = $${paramIndex} OR av."calibrationEndDate" IS NULL)`);
      params.push(AssetType.NON_CALIBRATED);
      paramIndex++;
    } else if (calibrationStatus === CalibrationStatus.EXPIRED) {
      filters.push(`(av."assetType" = $${paramIndex} AND av."calibrationEndDate" < NOW())`);
      params.push(AssetType.CALIBRATED);
      paramIndex++;
    } else if (calibrationStatus === CalibrationStatus.EXPIRING_SOON) {
      filters.push(`(
        av."assetType" = $${paramIndex}
        AND av."calibrationEndDate" >= NOW()
        AND av."calibrationEndDate" <= NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
      )`);
      params.push(AssetType.CALIBRATED);
      paramIndex++;
    } else if (calibrationStatus === CalibrationStatus.VALID) {
      filters.push(`(
        av."assetType" = $${paramIndex}
        AND av."calibrationEndDate" > NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
      )`);
      params.push(AssetType.CALIBRATED);
      paramIndex++;
    }
  }

  // Warranty status filter (computed)
  if (warrantyStatus) {
    if (warrantyStatus === WarrantyStatus.NOT_APPLICABLE) {
      filters.push(`av."warrantyEndDate" IS NULL`);
    } else if (warrantyStatus === WarrantyStatus.EXPIRED) {
      filters.push(`av."warrantyEndDate" < NOW()`);
    } else if (warrantyStatus === WarrantyStatus.EXPIRING_SOON) {
      filters.push(`(
        av."warrantyEndDate" >= NOW()
        AND av."warrantyEndDate" <= NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
      )`);
    } else if (warrantyStatus === WarrantyStatus.UNDER_WARRANTY) {
      filters.push(`av."warrantyEndDate" > NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'`);
    }
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const orderByColumn = ASSET_SORT_FIELD_MAPPING[sortField] || 'am."createdAt"';

  const dataQuery = `
    SELECT 
      am."id",
      am."assetId",
      am."createdAt",
      am."updatedAt",
      av."name",
      av."model",
      av."serialNumber",
      av."category",
      av."assetType",
      av."calibrationFrom",
      av."calibrationFrequency",
      av."calibrationStartDate",
      av."calibrationEndDate",
      av."purchaseDate",
      av."vendorName",
      av."warrantyStartDate",
      av."warrantyEndDate",
      av."status",
      av."assignedTo",
      av."remarks",
      av."additionalData"
    FROM "asset_masters" am
    INNER JOIN LATERAL (
      SELECT *
      FROM "asset_versions"
      WHERE "assetMasterId" = am."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) av ON true
    LEFT JOIN "users" u ON av."assignedTo" = u."id"
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT am."id") as total
    FROM "asset_masters" am
    INNER JOIN LATERAL (
      SELECT *
      FROM "asset_versions"
      WHERE "assetMasterId" = am."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) av ON true
    ${whereClause}
  `;

  // Keep filter params separate for count query
  const countParams = [...params];

  // Add pagination params for data query
  params.push(pageSize, offset);

  return {
    dataQuery,
    countQuery,
    params,
    countParams,
  };
};
