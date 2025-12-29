import {
  CalibrationStatus,
  WarrantyStatus,
  AssetType,
  AssetStatus,
} from '../../asset-masters/constants/asset-masters.constants';

/**
 * Asset Calibration Expiry Queries
 *
 * Queries for CRON 13: Asset Calibration Expiry Alerts
 *
 * Fetches CALIBRATED assets with calibration that is:
 * - Expired (calibrationEndDate < today)
 * - Expiring Soon (calibrationEndDate <= today + warningDays)
 *
 * Excludes:
 * - NON_CALIBRATED assets (assetType != 'CALIBRATED')
 * - RETIRED assets (status = 'RETIRED')
 * - Assets without calibrationEndDate
 */
export const getAssetsWithExpiringCalibrationQuery = (warningDays: number) => {
  return {
    query: `
      WITH asset_calibrations AS (
        SELECT
          am.id as "assetMasterId",
          am."assetId",
          av.id as "assetVersionId",
          av."name",
          av."model",
          av."serialNumber",
          av."category",
          av."assetType",
          av."status",
          av."assignedTo",
          av."calibrationFrom",
          av."calibrationFrequency",
          av."calibrationStartDate",
          av."calibrationEndDate",
          u."firstName" as "assignedFirstName",
          u."lastName" as "assignedLastName",
          u."email" as "assignedUserEmail",

          -- Calculate days until calibration expiry
          (av."calibrationEndDate"::date - CURRENT_DATE) as "daysUntilExpiry"

        FROM asset_masters am
        INNER JOIN LATERAL (
          SELECT *
          FROM asset_versions
          WHERE "assetMasterId" = am.id
            AND "isActive" = true
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) av ON true
        LEFT JOIN users u ON u.id = av."assignedTo" AND u."deletedAt" IS NULL
        WHERE am."deletedAt" IS NULL
          AND av."assetType" = $1
          AND av."status" != $2
          AND av."calibrationEndDate" IS NOT NULL
      )
      SELECT
        "assetMasterId",
        "assetId",
        "assetVersionId",
        "name",
        "model",
        "serialNumber",
        "category",
        "assetType",
        "status",
        "assignedTo",
        "assignedFirstName",
        "assignedLastName",
        "assignedUserEmail",
        "calibrationFrom",
        "calibrationFrequency",
        "calibrationStartDate",
        "calibrationEndDate",
        "daysUntilExpiry"
      FROM asset_calibrations
      WHERE "daysUntilExpiry" <= $3
      ORDER BY "daysUntilExpiry" ASC
    `,
    params: [AssetType.CALIBRATED, AssetStatus.RETIRED, warningDays],
  };
};

export const getCalibrationAlertStatus = (daysRemaining: number): CalibrationStatus => {
  if (daysRemaining < 0) {
    return CalibrationStatus.EXPIRED;
  }
  return CalibrationStatus.EXPIRING_SOON;
};

/**
 * Asset Warranty Expiry Queries
 *
 * Queries for CRON 14: Asset Warranty Expiry Alerts
 *
 * Fetches assets with warranty that is:
 * - Expired (warrantyEndDate < today)
 * - Expiring Soon (warrantyEndDate <= today + warningDays)
 *
 * Excludes:
 * - RETIRED assets (status = 'RETIRED')
 * - Assets without warrantyEndDate
 */
export const getAssetsWithExpiringWarrantyQuery = (warningDays: number) => {
  return {
    query: `
      WITH asset_warranties AS (
        SELECT
          am.id as "assetMasterId",
          am."assetId",
          av.id as "assetVersionId",
          av."name",
          av."model",
          av."serialNumber",
          av."category",
          av."assetType",
          av."status",
          av."assignedTo",
          av."vendorName",
          av."warrantyStartDate",
          av."warrantyEndDate",
          u."firstName" as "assignedFirstName",
          u."lastName" as "assignedLastName",
          u."email" as "assignedUserEmail",

          -- Calculate days until warranty expiry
          (av."warrantyEndDate"::date - CURRENT_DATE) as "daysUntilExpiry"

        FROM asset_masters am
        INNER JOIN LATERAL (
          SELECT *
          FROM asset_versions
          WHERE "assetMasterId" = am.id
            AND "isActive" = true
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) av ON true
        LEFT JOIN users u ON u.id = av."assignedTo" AND u."deletedAt" IS NULL
        WHERE am."deletedAt" IS NULL
          AND av."status" != $1
          AND av."warrantyEndDate" IS NOT NULL
      )
      SELECT
        "assetMasterId",
        "assetId",
        "assetVersionId",
        "name",
        "model",
        "serialNumber",
        "category",
        "assetType",
        "status",
        "assignedTo",
        "assignedFirstName",
        "assignedLastName",
        "assignedUserEmail",
        "vendorName",
        "warrantyStartDate",
        "warrantyEndDate",
        "daysUntilExpiry"
      FROM asset_warranties
      WHERE "daysUntilExpiry" <= $2
      ORDER BY "daysUntilExpiry" ASC
    `,
    params: [AssetStatus.RETIRED, warningDays],
  };
};

export const getWarrantyAlertStatus = (daysRemaining: number): WarrantyStatus => {
  if (daysRemaining < 0) {
    return WarrantyStatus.EXPIRED;
  }
  return WarrantyStatus.EXPIRING_SOON;
};

/**
 * Get summary counts of expiring calibrations
 * Used for dashboard/reporting
 * TODO: This can be used to show calibration expiry summary on dashboard
 */
export const getCalibrationExpirySummaryQuery = (warningDays: number) => {
  return {
    query: `
      WITH asset_calibrations AS (
        SELECT
          av."calibrationEndDate",
          (av."calibrationEndDate"::date - CURRENT_DATE) as "daysUntilExpiry"
        FROM asset_masters am
        INNER JOIN LATERAL (
          SELECT "calibrationEndDate", "assetType", "status"
          FROM asset_versions
          WHERE "assetMasterId" = am.id
            AND "isActive" = true
            AND "deletedAt" IS NULL
          LIMIT 1
        ) av ON true
        WHERE am."deletedAt" IS NULL
          AND av."assetType" = $1
          AND av."status" != $2
          AND av."calibrationEndDate" IS NOT NULL
      )
      SELECT
        COUNT(CASE WHEN "daysUntilExpiry" < 0 THEN 1 END)::int as "expiredCount",
        COUNT(CASE WHEN "daysUntilExpiry" >= 0 AND "daysUntilExpiry" <= $3 THEN 1 END)::int as "expiringSoonCount"
      FROM asset_calibrations
    `,
    params: [AssetType.CALIBRATED, AssetStatus.RETIRED, warningDays],
  };
};

/**
 * Get summary counts of expiring warranties
 * Used for dashboard/reporting
 * TODO: This can be used to show warranty expiry summary on dashboard
 */
export const getWarrantyExpirySummaryQuery = (warningDays: number) => {
  return {
    query: `
      WITH asset_warranties AS (
        SELECT
          av."warrantyEndDate",
          (av."warrantyEndDate"::date - CURRENT_DATE) as "daysUntilExpiry"
        FROM asset_masters am
        INNER JOIN LATERAL (
          SELECT "warrantyEndDate", "status"
          FROM asset_versions
          WHERE "assetMasterId" = am.id
            AND "isActive" = true
            AND "deletedAt" IS NULL
          LIMIT 1
        ) av ON true
        WHERE am."deletedAt" IS NULL
          AND av."status" != $1
          AND av."warrantyEndDate" IS NOT NULL
      )
      SELECT
        COUNT(CASE WHEN "daysUntilExpiry" < 0 THEN 1 END)::int as "expiredCount",
        COUNT(CASE WHEN "daysUntilExpiry" >= 0 AND "daysUntilExpiry" <= $2 THEN 1 END)::int as "expiringSoonCount"
      FROM asset_warranties
    `,
    params: [AssetStatus.RETIRED, warningDays],
  };
};
