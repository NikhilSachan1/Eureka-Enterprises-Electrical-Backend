/**
 * SQL queries for site module
 */

import {
  SITE_HEALTH_WEIGHTS,
  HEALTH_GRADE_THRESHOLDS,
} from '../../analytics/constants/analytics.constants';

/**
 * Get allocated employees for multiple sites in a single query
 * Returns siteId, employee count, and employee details
 */
export const getAllocatedEmployeesBySitesQuery = (siteIds: string[]) => {
  if (!siteIds.length) {
    return { query: '', params: [] };
  }

  const placeholders = siteIds.map((_, i) => `$${i + 1}`).join(', ');

  return {
    query: `
      SELECT 
        sa."id" AS "allocationId",
        sa."siteId",
        sa."userId",
        sa."role",
        sa."allocationType",
        sa."allocatedAt",
        u."firstName",
        u."lastName",
        u."email",
        u."profilePicture",
        u."employeeId"
      FROM site_allocations sa
      INNER JOIN users u ON sa."userId" = u.id
      WHERE sa."siteId" IN (${placeholders})
        AND sa."isCurrentlyAllocated" = true
        AND sa."deletedAt" IS NULL
        AND u."deletedAt" IS NULL
      ORDER BY sa."siteId", u."firstName"
    `,
    params: siteIds,
  };
};

/**
 * Get overall site statistics (status-wise counts)
 */
export const getOverallSiteStatsQuery = `
  SELECT
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL) as "totalSites",
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND status = 'upcoming') as "upcomingSites",
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND status = 'ongoing') as "ongoingSites",
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND status = 'hold') as "holdSites",
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND status = 'work_completed') as "workCompletedSites",
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND status = 'completed') as "completedSites",
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "isActive" = true) as "activeSites",
    COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "isActive" = false) as "inactiveSites"
  FROM sites
`;

/**
 * Get health scores for multiple sites in a single query
 * Returns siteId, healthScore, and healthGrade for each site
 */
export const getSiteHealthScoresQuery = (siteIds: string[]) => {
  if (!siteIds.length) {
    return { query: '', params: [] };
  }

  const placeholders = siteIds.map((_, i) => `$${i + 1}`).join(', ');

  return {
    query: `
      WITH site_metrics AS (
        SELECT
          s.id,
          -- Timeline metrics
          GREATEST(1, COALESCE(s."endDate"::date, (CURRENT_DATE + INTERVAL '30 days')::date) - s."startDate"::date) as total_days,
          GREATEST(0, CURRENT_DATE - s."startDate"::date) as days_elapsed,
          GREATEST(0, CASE 
            WHEN s."endDate" IS NOT NULL AND CURRENT_DATE > s."endDate" 
            THEN (CURRENT_DATE - s."endDate"::date)
            ELSE 0 
          END) as days_delayed,
          
          -- Payment metrics sourced from the dedicated financial tables.
          -- site_documents no longer carries financial columns (direction,
          -- totalAmount, paymentStatus were dropped by migration 1835000000000).
          -- total_receivable = sum of SALE-side approved invoices
          COALESCE((
            SELECT SUM(si."totalAmount")
            FROM site_invoices si
            WHERE si."siteId" = s.id AND si."deletedAt" IS NULL AND si."partyType" = 'SALE'
              AND si."approvalStatus" = 'APPROVED'
          ), 0) as total_receivable,
          -- collected_amount = sum of SALE-side bank transfers (what's actually been received)
          COALESCE((
            SELECT SUM(bt."transferAmount")
            FROM bank_transfers bt
            WHERE bt."siteId" = s.id AND bt."deletedAt" IS NULL AND bt."partyType" = 'SALE'
          ), 0) as collected_amount,

          -- Document count (non-financial site docs only)
          COALESCE((SELECT COUNT(*) FROM site_documents sd WHERE sd."siteId" = s.id AND sd."deletedAt" IS NULL), 0) as total_documents,
          
          -- Daily reporting metrics
          COALESCE((SELECT COUNT(DISTINCT dsr."reportDate") 
           FROM daily_status_reports dsr 
           WHERE dsr."siteId" = s.id AND dsr."deletedAt" IS NULL), 0) as days_with_reports
          
        FROM sites s
        WHERE s.id IN (${placeholders}) AND s."deletedAt" IS NULL
      ),
      health_scores AS (
        SELECT
          sm.id as "siteId",
          
          -- Timeline score: 100 - (daysDelayed / totalDays * 100), capped 0-100
          GREATEST(0, LEAST(100, 100 - (sm.days_delayed::decimal / sm.total_days * 100))) as timeline_score,
          
          -- Payment score: (collected / receivable) * 100, or 100 if no receivables
          CASE WHEN sm.total_receivable > 0 
            THEN LEAST(100, (sm.collected_amount / sm.total_receivable * 100))
            ELSE 100 
          END as payment_score,
          
          -- Work progress: placeholder at 75%
          75 as work_progress_score,
          
          -- Document score: (docs / 5) * 100, capped at 100
          LEAST(100, (sm.total_documents::decimal / 5 * 100)) as document_score,
          
          -- Reporting score: (daysWithReports / daysElapsed) * 100, or 100 if no days elapsed
          CASE WHEN sm.days_elapsed > 0 
            THEN LEAST(100, (sm.days_with_reports::decimal / sm.days_elapsed * 100))
            ELSE 100 
          END as reporting_score
          
        FROM site_metrics sm
      )
      SELECT
        hs."siteId",
        ROUND(
          (hs.timeline_score * ${SITE_HEALTH_WEIGHTS.TIMELINE_ADHERENCE} + 
           hs.payment_score * ${SITE_HEALTH_WEIGHTS.PAYMENT_COLLECTION} + 
           hs.work_progress_score * ${SITE_HEALTH_WEIGHTS.WORK_PROGRESS} + 
           hs.document_score * ${SITE_HEALTH_WEIGHTS.DOCUMENT_COMPLETION} + 
           hs.reporting_score * ${SITE_HEALTH_WEIGHTS.DAILY_REPORTING}) / 100
        )::integer as "healthScore",
        CASE 
          WHEN ROUND((hs.timeline_score * ${SITE_HEALTH_WEIGHTS.TIMELINE_ADHERENCE} + hs.payment_score * ${SITE_HEALTH_WEIGHTS.PAYMENT_COLLECTION} + hs.work_progress_score * ${SITE_HEALTH_WEIGHTS.WORK_PROGRESS} + hs.document_score * ${SITE_HEALTH_WEIGHTS.DOCUMENT_COMPLETION} + hs.reporting_score * ${SITE_HEALTH_WEIGHTS.DAILY_REPORTING}) / 100) >= ${HEALTH_GRADE_THRESHOLDS.A} THEN 'A'
          WHEN ROUND((hs.timeline_score * ${SITE_HEALTH_WEIGHTS.TIMELINE_ADHERENCE} + hs.payment_score * ${SITE_HEALTH_WEIGHTS.PAYMENT_COLLECTION} + hs.work_progress_score * ${SITE_HEALTH_WEIGHTS.WORK_PROGRESS} + hs.document_score * ${SITE_HEALTH_WEIGHTS.DOCUMENT_COMPLETION} + hs.reporting_score * ${SITE_HEALTH_WEIGHTS.DAILY_REPORTING}) / 100) >= ${HEALTH_GRADE_THRESHOLDS.B} THEN 'B'
          WHEN ROUND((hs.timeline_score * ${SITE_HEALTH_WEIGHTS.TIMELINE_ADHERENCE} + hs.payment_score * ${SITE_HEALTH_WEIGHTS.PAYMENT_COLLECTION} + hs.work_progress_score * ${SITE_HEALTH_WEIGHTS.WORK_PROGRESS} + hs.document_score * ${SITE_HEALTH_WEIGHTS.DOCUMENT_COMPLETION} + hs.reporting_score * ${SITE_HEALTH_WEIGHTS.DAILY_REPORTING}) / 100) >= ${HEALTH_GRADE_THRESHOLDS.C} THEN 'C'
          ELSE 'D'
        END as "healthGrade"
      FROM health_scores hs
    `,
    params: siteIds,
  };
};
