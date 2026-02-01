/**
 * SQL queries for site module
 */

import {
  SITE_HEALTH_WEIGHTS,
  HEALTH_GRADE_THRESHOLDS,
} from '../../analytics/constants/analytics.constants';

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
          
          -- Payment metrics
          COALESCE((
            SELECT SUM(sd."totalAmount")
            FROM site_documents sd
            WHERE sd."siteId" = s.id AND sd."deletedAt" IS NULL AND sd.direction = 'RECEIVABLE'
          ), 0) as total_receivable,
          COALESCE((
            SELECT SUM(sd."totalAmount")
            FROM site_documents sd
            WHERE sd."siteId" = s.id AND sd."deletedAt" IS NULL 
            AND sd.direction = 'RECEIVABLE' AND sd."paymentStatus" = 'PAID'
          ), 0) as collected_amount,
          
          -- Document count
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
