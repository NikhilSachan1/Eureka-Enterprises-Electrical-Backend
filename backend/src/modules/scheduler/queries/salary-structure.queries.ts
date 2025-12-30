/**
 * Salary Structure Queries
 *
 * Queries for CRON 18: Salary Structure Activation/Deactivation
 *
 * Handles:
 * 1. Pending structures to activate (effectiveFrom <= today, isActive = false)
 * 2. Expired structures to deactivate (effectiveTo < today, isActive = true)
 * 3. Current active structure for a user (to be superseded)
 *
 * Validations:
 * - Only considers non-deleted salary structures
 * - Only considers non-deleted users
 * - Handles multiple pending structures per user (activates earliest first)
 */

/**
 * Get salary structures pending activation
 * These are structures where:
 * - effectiveFrom <= TODAY (should have started by now)
 * - isActive = false (not yet activated)
 * - deletedAt IS NULL (not deleted)
 * - User is not deleted
 *
 * Orders by effectiveFrom ASC to activate oldest pending first
 */
export const getPendingActivationStructuresQuery = () => {
  return {
    query: `
      SELECT
        ss.id,
        ss."userId",
        ss."effectiveFrom",
        ss."effectiveTo",
        ss."isActive",
        ss."previousStructureId",
        ss."incrementType",
        ss."grossSalary"::numeric,
        ss."netSalary"::numeric,
        ss."ctc"::numeric,
        u."employeeId",
        u."firstName",
        u."lastName",
        u.email
      FROM salary_structures ss
      INNER JOIN users u ON u.id = ss."userId" AND u."deletedAt" IS NULL
      WHERE ss."deletedAt" IS NULL
        AND ss."isActive" = false
        AND ss."effectiveFrom" <= CURRENT_DATE
      ORDER BY ss."userId", ss."effectiveFrom" ASC
    `,
    params: [],
  };
};

/**
 * Get salary structures that have expired and need deactivation
 * These are structures where:
 * - effectiveTo < TODAY (end date has passed)
 * - isActive = true (still marked as active)
 * - deletedAt IS NULL (not deleted)
 */
export const getExpiredActiveStructuresQuery = () => {
  return {
    query: `
      SELECT
        ss.id,
        ss."userId",
        ss."effectiveFrom",
        ss."effectiveTo",
        ss."isActive",
        u."employeeId",
        u."firstName",
        u."lastName"
      FROM salary_structures ss
      INNER JOIN users u ON u.id = ss."userId" AND u."deletedAt" IS NULL
      WHERE ss."deletedAt" IS NULL
        AND ss."isActive" = true
        AND ss."effectiveTo" IS NOT NULL
        AND ss."effectiveTo" < CURRENT_DATE
      ORDER BY ss."userId", ss."effectiveTo" ASC
    `,
    params: [],
  };
};

export const getCurrentActiveStructureQuery = (userId: string) => {
  return {
    query: `
      SELECT
        ss.id,
        ss."userId",
        ss."effectiveFrom",
        ss."effectiveTo",
        ss."isActive"
      FROM salary_structures ss
      WHERE ss."deletedAt" IS NULL
        AND ss."isActive" = true
        AND ss."userId" = $1
      LIMIT 1
    `,
    params: [userId],
  };
};

export const activateSalaryStructureQuery = (structureId: string) => {
  return {
    query: `
      UPDATE salary_structures
      SET "isActive" = true, "updatedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL
      RETURNING id, "userId", "isActive"
    `,
    params: [structureId],
  };
};

export const deactivateSalaryStructureQuery = (
  structureId: string,
  effectiveTo: Date | null = null,
) => {
  if (effectiveTo) {
    return {
      query: `
        UPDATE salary_structures
        SET "isActive" = false, "effectiveTo" = $2, "updatedAt" = NOW()
        WHERE id = $1 AND "deletedAt" IS NULL
        RETURNING id, "userId", "isActive", "effectiveTo"
      `,
      params: [structureId, effectiveTo],
    };
  }
  return {
    query: `
      UPDATE salary_structures
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL
      RETURNING id, "userId", "isActive"
    `,
    params: [structureId],
  };
};
