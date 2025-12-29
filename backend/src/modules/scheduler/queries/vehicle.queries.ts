/**
 * Vehicle Document Expiry Queries
 *
 * Queries for CRON 11: Vehicle Document Expiry Alerts
 *
 * Fetches vehicles with documents that are:
 * - Expired (end date < today)
 * - Expiring Soon (end date <= today + warningDays)
 */

import { DocumentAlertStatus } from '../types/vehicle.types';

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
