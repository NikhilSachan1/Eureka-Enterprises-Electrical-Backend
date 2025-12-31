import { AssetQueryDto } from '../dto/asset-query.dto';
import {
  ASSET_SORT_FIELD_MAPPING,
  AssetType,
  AssetStatus,
  AssetFileTypes,
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

  if (category && category.length > 0) {
    const placeholders = category.map((_, i) => `$${paramIndex + i}`).join(', ');
    filters.push(`av."category" IN (${placeholders})`);
    params.push(...category);
    paramIndex += category.length;
  }

  if (assetType && assetType.length > 0) {
    const placeholders = assetType.map((_, i) => `$${paramIndex + i}`).join(', ');
    filters.push(`av."assetType" IN (${placeholders})`);
    params.push(...assetType);
    paramIndex += assetType.length;
  }

  if (status && status.length > 0) {
    const placeholders = status.map((_, i) => `$${paramIndex + i}`).join(', ');
    filters.push(`av."status" IN (${placeholders})`);
    params.push(...status);
    paramIndex += status.length;
  }

  if (assignedTo && assignedTo.length > 0) {
    const placeholders = assignedTo.map((_, i) => `$${paramIndex + i}`).join(', ');
    filters.push(`av."assignedTo" IN (${placeholders})`);
    params.push(...assignedTo);
    paramIndex += assignedTo.length;
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

  // Calibration status filter (computed) - supports multiple values
  if (calibrationStatus && calibrationStatus.length > 0) {
    const calibrationConditions: string[] = [];

    if (calibrationStatus.includes(CalibrationStatus.NOT_APPLICABLE)) {
      calibrationConditions.push(
        `(av."assetType" = $${paramIndex} OR av."calibrationEndDate" IS NULL)`,
      );
      params.push(AssetType.NON_CALIBRATED);
      paramIndex++;
    }
    if (calibrationStatus.includes(CalibrationStatus.EXPIRED)) {
      calibrationConditions.push(
        `(av."assetType" = $${paramIndex} AND av."calibrationEndDate" < NOW())`,
      );
      params.push(AssetType.CALIBRATED);
      paramIndex++;
    }
    if (calibrationStatus.includes(CalibrationStatus.EXPIRING_SOON)) {
      calibrationConditions.push(`(
        av."assetType" = $${paramIndex}
        AND av."calibrationEndDate" >= NOW()
        AND av."calibrationEndDate" <= NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
      )`);
      params.push(AssetType.CALIBRATED);
      paramIndex++;
    }
    if (calibrationStatus.includes(CalibrationStatus.VALID)) {
      calibrationConditions.push(`(
        av."assetType" = $${paramIndex}
        AND av."calibrationEndDate" > NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
      )`);
      params.push(AssetType.CALIBRATED);
      paramIndex++;
    }

    if (calibrationConditions.length > 0) {
      filters.push(`(${calibrationConditions.join(' OR ')})`);
    }
  }

  // Warranty status filter (computed) - supports multiple values
  if (warrantyStatus && warrantyStatus.length > 0) {
    const warrantyConditions: string[] = [];

    if (warrantyStatus.includes(WarrantyStatus.NOT_APPLICABLE)) {
      warrantyConditions.push(`av."warrantyEndDate" IS NULL`);
    }
    if (warrantyStatus.includes(WarrantyStatus.EXPIRED)) {
      warrantyConditions.push(`av."warrantyEndDate" < NOW()`);
    }
    if (warrantyStatus.includes(WarrantyStatus.EXPIRING_SOON)) {
      warrantyConditions.push(`(
        av."warrantyEndDate" >= NOW()
        AND av."warrantyEndDate" <= NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'
      )`);
    }
    if (warrantyStatus.includes(WarrantyStatus.UNDER_WARRANTY)) {
      warrantyConditions.push(
        `av."warrantyEndDate" > NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'`,
      );
    }

    if (warrantyConditions.length > 0) {
      filters.push(`(${warrantyConditions.join(' OR ')})`);
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
      av."additionalData",
      u."id" as "assignedToUserId",
      u."firstName" as "assignedToFirstName",
      u."lastName" as "assignedToLastName",
      u."email" as "assignedToEmail",
      u."employeeId" as "assignedToEmployeeId",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', af."id",
              'fileKey', af."fileKey",
              'fileType', af."fileType",
              'label', af."label"
            )
          )
          FROM "assets_files" af
          WHERE af."assetVersionId" = av."id"
            AND af."fileType" = '${AssetFileTypes.ASSET_IMAGE}'
            AND af."deletedAt" IS NULL
        ),
        '[]'::json
      ) as "files"
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
