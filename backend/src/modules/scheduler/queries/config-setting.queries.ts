/**
 * Config Setting Queries
 *
 * Queries for CRON 19: Config Setting Activation/Deactivation
 *
 * Handles:
 * 1. Pending settings to activate (effectiveFrom <= today, isActive = false)
 * 2. Expired settings to deactivate (effectiveTo < today, isActive = true)
 * 3. Current active setting for a config+context (to be superseded)
 *
 * Key Concepts:
 * - configId: The parent configuration
 * - contextKey: Optional context (e.g., financial year for leave configs)
 * - Only ONE active setting per configId + contextKey combination
 */

/**
 * Get config settings pending activation
 * These are settings where:
 * - effectiveFrom <= TODAY (should have started by now)
 * - isActive = false (not yet activated)
 * - deletedAt IS NULL (not deleted)
 *
 * Orders by effectiveFrom ASC to activate oldest pending first
 */
export const getPendingActivationSettingsQuery = () => {
  return {
    query: `
      SELECT
        cs.id,
        cs."configId",
        cs."contextKey",
        cs.value,
        cs."effectiveFrom",
        cs."effectiveTo",
        cs."isActive",
        c.key as "configKey",
        c.module as "configModule",
        c.label as "configLabel"
      FROM config_settings cs
      INNER JOIN configurations c ON c.id = cs."configId" AND c."deletedAt" IS NULL
      WHERE cs."deletedAt" IS NULL
        AND cs."isActive" = false
        AND cs."effectiveFrom" IS NOT NULL
        AND cs."effectiveFrom" <= CURRENT_DATE
      ORDER BY cs."configId", cs."contextKey" NULLS FIRST, cs."effectiveFrom" ASC
    `,
    params: [],
  };
};

/**
 * Get config settings that have expired and need deactivation
 * These are settings where:
 * - effectiveTo < TODAY (end date has passed)
 * - isActive = true (still marked as active)
 * - deletedAt IS NULL (not deleted)
 */
export const getExpiredActiveSettingsQuery = () => {
  return {
    query: `
      SELECT
        cs.id,
        cs."configId",
        cs."contextKey",
        cs."effectiveFrom",
        cs."effectiveTo",
        cs."isActive",
        c.key as "configKey",
        c.module as "configModule",
        c.label as "configLabel"
      FROM config_settings cs
      INNER JOIN configurations c ON c.id = cs."configId" AND c."deletedAt" IS NULL
      WHERE cs."deletedAt" IS NULL
        AND cs."isActive" = true
        AND cs."effectiveTo" IS NOT NULL
        AND cs."effectiveTo" < CURRENT_DATE
      ORDER BY cs."configId", cs."contextKey" NULLS FIRST, cs."effectiveTo" ASC
    `,
    params: [],
  };
};

/**
 * Get current active setting for a config + context combination
 */
export const getCurrentActiveSettingQuery = (configId: string, contextKey: string | null) => {
  if (contextKey === null) {
    return {
      query: `
        SELECT
          cs.id,
          cs."configId",
          cs."contextKey",
          cs."effectiveFrom",
          cs."effectiveTo",
          cs."isActive"
        FROM config_settings cs
        WHERE cs."deletedAt" IS NULL
          AND cs."isActive" = true
          AND cs."configId" = $1
          AND cs."contextKey" IS NULL
        LIMIT 1
      `,
      params: [configId],
    };
  }
  return {
    query: `
      SELECT
        cs.id,
        cs."configId",
        cs."contextKey",
        cs."effectiveFrom",
        cs."effectiveTo",
        cs."isActive"
      FROM config_settings cs
      WHERE cs."deletedAt" IS NULL
        AND cs."isActive" = true
        AND cs."configId" = $1
        AND cs."contextKey" = $2
      LIMIT 1
    `,
    params: [configId, contextKey],
  };
};

export const activateConfigSettingQuery = (settingId: string) => {
  return {
    query: `
      UPDATE config_settings
      SET "isActive" = true, "updatedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL
      RETURNING id, "configId", "contextKey", "isActive"
    `,
    params: [settingId],
  };
};

export const deactivateConfigSettingQuery = (
  settingId: string,
  effectiveTo: Date | null = null,
) => {
  if (effectiveTo) {
    return {
      query: `
        UPDATE config_settings
        SET "isActive" = false, "effectiveTo" = $2, "updatedAt" = NOW()
        WHERE id = $1 AND "deletedAt" IS NULL
        RETURNING id, "configId", "contextKey", "isActive", "effectiveTo"
      `,
      params: [settingId, effectiveTo],
    };
  }
  return {
    query: `
      UPDATE config_settings
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL
      RETURNING id, "configId", "contextKey", "isActive"
    `,
    params: [settingId],
  };
};
