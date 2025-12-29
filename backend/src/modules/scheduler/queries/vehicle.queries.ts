import { DocumentAlertStatus } from '../types/vehicle.types';
import { ServiceDueAlertStatus } from '../types/vehicle.types';

/**
 * Vehicle Document Expiry Queries
 *
 * Queries for CRON 11: Vehicle Document Expiry Alerts
 *
 * Fetches vehicles with documents that are:
 * - Expired (end date < today)
 * - Expiring Soon (end date <= today + warningDays)
 */

/**
 * Get all vehicles with documents that are expired or expiring soon
 *
 * Uses LATERAL join to get active vehicle version for each master
 * Calculates days until expiry for each document type
 * Only returns vehicles where at least one document is expired or expiring soon
 */
export const getVehiclesWithExpiringDocumentsQuery = (warningDays: number) => {
  return {
    query: `
      WITH vehicle_documents AS (
        SELECT 
          vm.id as "vehicleMasterId",
          vm."registrationNo",
          vv.id as "vehicleVersionId",
          vv."number",
          vv."brand",
          vv."model",
          vv."assignedTo",
          vv."insuranceEndDate",
          vv."pucEndDate",
          vv."fitnessEndDate",
          u."firstName" as "assignedFirstName",
          u."lastName" as "assignedLastName",
          u."email" as "assignedUserEmail",
          
          -- Calculate days until expiry for each document
          CASE 
            WHEN vv."insuranceEndDate" IS NOT NULL 
            THEN (vv."insuranceEndDate"::date - CURRENT_DATE)
            ELSE NULL 
          END as "insuranceDaysRemaining",
          
          CASE 
            WHEN vv."pucEndDate" IS NOT NULL 
            THEN (vv."pucEndDate"::date - CURRENT_DATE)
            ELSE NULL 
          END as "pucDaysRemaining",
          
          CASE 
            WHEN vv."fitnessEndDate" IS NOT NULL 
            THEN (vv."fitnessEndDate"::date - CURRENT_DATE)
            ELSE NULL 
          END as "fitnessDaysRemaining"
          
        FROM vehicle_masters vm
        INNER JOIN LATERAL (
          SELECT *
          FROM vehicle_versions
          WHERE "vehicleMasterId" = vm.id
            AND "isActive" = true
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) vv ON true
        LEFT JOIN users u ON u.id = vv."assignedTo" AND u."deletedAt" IS NULL
        WHERE vm."deletedAt" IS NULL
          AND vv."status" != 'RETIRED'
      )
      SELECT 
        "vehicleMasterId",
        "registrationNo",
        "vehicleVersionId",
        "number",
        "brand",
        "model",
        "assignedTo",
        "assignedFirstName",
        "assignedLastName",
        "assignedUserEmail",
        "insuranceEndDate",
        "pucEndDate",
        "fitnessEndDate",
        "insuranceDaysRemaining",
        "pucDaysRemaining",
        "fitnessDaysRemaining"
      FROM vehicle_documents
      WHERE 
        -- At least one document is expired or expiring soon
        ("insuranceDaysRemaining" IS NOT NULL AND "insuranceDaysRemaining" <= $1)
        OR ("pucDaysRemaining" IS NOT NULL AND "pucDaysRemaining" <= $1)
        OR ("fitnessDaysRemaining" IS NOT NULL AND "fitnessDaysRemaining" <= $1)
      ORDER BY 
        -- Order by most urgent (most negative days = most overdue)
        LEAST(
          COALESCE("insuranceDaysRemaining", 999999),
          COALESCE("pucDaysRemaining", 999999),
          COALESCE("fitnessDaysRemaining", 999999)
        ) ASC
    `,
    params: [warningDays],
  };
};

/**
 * Get summary counts of expiring documents
 * Used for dashboard/reporting
 * TODO: This can be used to get the total number of vehicles with expiring documents, and can be shown on dashboard
 */
export const getDocumentExpirySummaryQuery = (warningDays: number) => {
  return {
    query: `
      WITH vehicle_documents AS (
        SELECT 
          vv."insuranceEndDate",
          vv."pucEndDate",
          vv."fitnessEndDate"
        FROM vehicle_masters vm
        INNER JOIN LATERAL (
          SELECT "insuranceEndDate", "pucEndDate", "fitnessEndDate", "status"
          FROM vehicle_versions
          WHERE "vehicleMasterId" = vm.id
            AND "isActive" = true
            AND "deletedAt" IS NULL
          LIMIT 1
        ) vv ON true
        WHERE vm."deletedAt" IS NULL
          AND vv."status" != 'RETIRED'
      )
      SELECT 
        -- Expired counts
        COUNT(CASE WHEN "insuranceEndDate"::date < CURRENT_DATE THEN 1 END)::int as "expiredInsurance",
        COUNT(CASE WHEN "pucEndDate"::date < CURRENT_DATE THEN 1 END)::int as "expiredPuc",
        COUNT(CASE WHEN "fitnessEndDate"::date < CURRENT_DATE THEN 1 END)::int as "expiredFitness",
        
        -- Expiring soon counts (within warning period but not yet expired)
        COUNT(CASE 
          WHEN "insuranceEndDate"::date >= CURRENT_DATE 
            AND "insuranceEndDate"::date <= CURRENT_DATE + $1::int 
          THEN 1 
        END)::int as "expiringSoonInsurance",
        
        COUNT(CASE 
          WHEN "pucEndDate"::date >= CURRENT_DATE 
            AND "pucEndDate"::date <= CURRENT_DATE + $1::int 
          THEN 1 
        END)::int as "expiringSoonPuc",
        
        COUNT(CASE 
          WHEN "fitnessEndDate"::date >= CURRENT_DATE 
            AND "fitnessEndDate"::date <= CURRENT_DATE + $1::int 
          THEN 1 
        END)::int as "expiringSoonFitness"
        
      FROM vehicle_documents
    `,
    params: [warningDays],
  };
};

export const getDocumentAlertStatus = (daysRemaining: number): DocumentAlertStatus => {
  if (daysRemaining < 0) {
    return DocumentAlertStatus.EXPIRED;
  }
  return DocumentAlertStatus.EXPIRING_SOON;
};

export const getDocumentTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    insurance: 'Insurance',
    puc: 'PUC (Pollution Certificate)',
    fitness: 'Fitness Certificate',
  };
  return labels[type] || type;
};

/**
 * ============================================================
 * CRON 12: Vehicle Service Due Reminders
 * ============================================================
 *
 * Service due is calculated based on KM (odometer reading):
 * - lastServiceKm: Stored in vehicle_versions
 * - currentOdometerKm: MAX from fuel_expenses or vehicle_services
 * - serviceIntervalKm: From config (default: 10000 km)
 * - warningKm: From config (default: 1000 km)
 *
 * Status Logic:
 * - OVERDUE: kmToNextService <= 0 (crossed service interval)
 * - DUE_SOON: 0 < kmToNextService <= warningKm
 * - OK: kmToNextService > warningKm (no alert)
 */

/**
 * Get all vehicles with service due or overdue
 *
 * Joins vehicle_versions with fuel_expenses and vehicle_services to get current odometer
 * Calculates km to next service based on lastServiceKm + serviceIntervalKm
 */
export const getVehiclesWithServiceDueQuery = (serviceIntervalKm: number, warningKm: number) => {
  return {
    query: `
      WITH vehicle_service_data AS (
        SELECT 
          vm.id as "vehicleMasterId",
          vm."registrationNo",
          vv."number",
          vv."brand",
          vv."model",
          vv."assignedTo",
          vv."lastServiceKm",
          vv."lastServiceDate",
          u."firstName" as "assignedFirstName",
          u."lastName" as "assignedLastName",
          u."email" as "assignedUserEmail",
          
          -- Get current odometer reading (MAX from fuel_expenses or vehicle_services)
          COALESCE(
            GREATEST(
              (SELECT MAX("odometerReading") FROM fuel_expenses WHERE "vehicleMasterId" = vm.id AND "deletedAt" IS NULL),
              (SELECT MAX("odometerReading") FROM vehicle_services WHERE "vehicleMasterId" = vm.id AND "deletedAt" IS NULL)
            ),
            0
          )::int as "currentOdometerKm"
          
        FROM vehicle_masters vm
        INNER JOIN LATERAL (
          SELECT *
          FROM vehicle_versions
          WHERE "vehicleMasterId" = vm.id
            AND "isActive" = true
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) vv ON true
        LEFT JOIN users u ON u.id = vv."assignedTo" AND u."deletedAt" IS NULL
        WHERE vm."deletedAt" IS NULL
          AND vv."status" != 'RETIRED'
          AND vv."lastServiceKm" IS NOT NULL
      ),
      service_calculations AS (
        SELECT 
          *,
          ("lastServiceKm" + $1) as "nextServiceDueKm",
          (("lastServiceKm" + $1) - "currentOdometerKm") as "kmToNextService",
          ("currentOdometerKm" - "lastServiceKm") as "kmSinceLastService"
        FROM vehicle_service_data
        WHERE "currentOdometerKm" > 0
      )
      SELECT 
        "vehicleMasterId",
        "registrationNo",
        "number",
        "brand",
        "model",
        "assignedTo",
        "assignedFirstName",
        "assignedLastName",
        "assignedUserEmail",
        "lastServiceKm",
        "lastServiceDate",
        "currentOdometerKm",
        "nextServiceDueKm",
        "kmToNextService",
        "kmSinceLastService",
        CASE 
          WHEN "kmToNextService" <= 0 THEN 'OVERDUE'
          ELSE 'DUE_SOON'
        END as "serviceDueStatus"
      FROM service_calculations
      WHERE "kmToNextService" <= $2
      ORDER BY "kmToNextService" ASC
    `,
    params: [serviceIntervalKm, warningKm],
  };
};

/**
 * Get vehicles without service history (for reporting)
 * These vehicles have no lastServiceKm set
 * TODO: This can be used to get the total number of vehicles without service history, and can be shown on dashboard
 */
export const getVehiclesWithoutServiceHistoryQuery = () => {
  return {
    query: `
      SELECT 
        vm.id as "vehicleMasterId",
        vm."registrationNo",
        vv."number",
        vv."brand",
        vv."model"
      FROM vehicle_masters vm
      INNER JOIN LATERAL (
        SELECT "number", "brand", "model", "lastServiceKm", "status"
        FROM vehicle_versions
        WHERE "vehicleMasterId" = vm.id
          AND "isActive" = true
          AND "deletedAt" IS NULL
        LIMIT 1
      ) vv ON true
      WHERE vm."deletedAt" IS NULL
        AND vv."status" != 'RETIRED'
        AND vv."lastServiceKm" IS NULL
    `,
    params: [],
  };
};

export const getServiceDueAlertStatus = (kmToNextService: number): ServiceDueAlertStatus => {
  if (kmToNextService <= 0) {
    return ServiceDueAlertStatus.OVERDUE;
  }
  return ServiceDueAlertStatus.DUE_SOON;
};
