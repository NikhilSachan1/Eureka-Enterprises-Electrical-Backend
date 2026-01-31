/**
 * Analytics Module Constants
 * Centralized constants for analytics endpoints, calculations, and responses
 */

// ==================== ANALYTICS SECTION IDENTIFIERS ====================

/**
 * Available analytics sections that can be requested
 */
export enum AnalyticsSection {
  EXECUTIVE_DASHBOARD = 'executive_dashboard',
  SITE_PROFITABILITY = 'site_profitability',
  INVOICE_AGING = 'invoice_aging',
  CONTRACTOR_PERFORMANCE = 'contractor_performance',
  EMPLOYEE_PRODUCTIVITY = 'employee_productivity',
  VEHICLE_ANALYTICS = 'vehicle_analytics',
  SITE_HEALTH = 'site_health',
  SITE_TIMELINE = 'site_timeline',
}

/**
 * Period options for analytics date ranges
 */
export enum AnalyticsPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom',
  ALL_TIME = 'all_time',
}

// ==================== INVOICE AGING BUCKETS ====================

/**
 * Invoice aging bucket definitions (in days)
 */
export const INVOICE_AGING_BUCKETS = {
  CURRENT: { min: 0, max: 30, label: '0-30 days' },
  DAYS_31_60: { min: 31, max: 60, label: '31-60 days' },
  DAYS_61_90: { min: 61, max: 90, label: '61-90 days' },
  OVERDUE_90_PLUS: { min: 91, max: Infinity, label: '90+ days' },
} as const;

// ==================== SITE HEALTH SCORE WEIGHTS ====================

/**
 * Weight configuration for site health score calculation
 * Total must equal 100
 */
export const SITE_HEALTH_WEIGHTS = {
  TIMELINE_ADHERENCE: 30, // On-time progress
  PAYMENT_COLLECTION: 25, // Revenue collection rate
  WORK_PROGRESS: 20, // Actual work completion
  DOCUMENT_COMPLETION: 15, // Required docs uploaded
  DAILY_REPORTING: 10, // DSR compliance
} as const;

/**
 * Health score grade thresholds
 */
export const HEALTH_GRADE_THRESHOLDS = {
  A: 80, // 80-100 = Grade A (Excellent)
  B: 60, // 60-79 = Grade B (Good)
  C: 40, // 40-59 = Grade C (Needs Improvement)
  // Below 40 = Grade D (At Risk)
} as const;

// ==================== ANALYTICS ENTITY FIELDS ====================

export const AnalyticsEntityFields = {
  ANALYTICS: 'Analytics',
  SITE_PROFITABILITY: 'Site Profitability',
  INVOICE_AGING: 'Invoice Aging',
  CONTRACTOR: 'Contractor Analytics',
  EMPLOYEE: 'Employee Analytics',
  VEHICLE: 'Vehicle Analytics',
  HEALTH_SCORE: 'Site Health Score',
};

// ==================== ERROR MESSAGES ====================

export const ANALYTICS_ERRORS = {
  SITE_NOT_FOUND: 'Site not found',
  CONTRACTOR_NOT_FOUND: 'Contractor not found',
  EMPLOYEE_NOT_FOUND: 'Employee not found',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  INVALID_DATE_RANGE: 'Invalid date range. Start date must be before end date.',
  INVALID_SECTION: 'Invalid analytics section: {section}',
  INVALID_PERIOD: 'Invalid period: {period}',
  NO_DATA_AVAILABLE: 'No data available for the specified criteria',
  CUSTOM_DATES_REQUIRED: 'Start date and end date are required for custom period',
};

// ==================== SUCCESS MESSAGES ====================

export const ANALYTICS_RESPONSES = {
  DASHBOARD_FETCHED: 'Executive dashboard data fetched successfully',
  PROFITABILITY_FETCHED: 'Site profitability data fetched successfully',
  AGING_REPORT_FETCHED: 'Invoice aging report fetched successfully',
  CONTRACTOR_ANALYTICS_FETCHED: 'Contractor analytics fetched successfully',
  EMPLOYEE_ANALYTICS_FETCHED: 'Employee analytics fetched successfully',
  VEHICLE_ANALYTICS_FETCHED: 'Vehicle analytics fetched successfully',
  HEALTH_SCORE_FETCHED: 'Site health score fetched successfully',
  TIMELINE_FETCHED: 'Site timeline fetched successfully',
};

// ==================== DEFAULT VALUES ====================

export const ANALYTICS_DEFAULTS = {
  TOP_PERFORMERS_LIMIT: 10,
  RECENT_ANOMALIES_LIMIT: 10,
  TIMELINE_EVENTS_LIMIT: 50,
  TREND_MONTHS: 6,
  PAGE_SIZE: 20,
};

// ==================== DOCUMENT DIRECTIONS ====================

export const DocumentDirection = {
  RECEIVABLE: 'RECEIVABLE', // Income (PO from client, invoice to client)
  PAYABLE: 'PAYABLE', // Expense (invoice from contractor, PO to vendor)
} as const;

// ==================== TIMELINE EVENT TYPES ====================

export enum TimelineEventType {
  SITE_CREATED = 'SITE_CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  CONTRACTOR_ASSIGNED = 'CONTRACTOR_ASSIGNED',
  CONTRACTOR_REMOVED = 'CONTRACTOR_REMOVED',
  EMPLOYEE_ALLOCATED = 'EMPLOYEE_ALLOCATED',
  EMPLOYEE_DEALLOCATED = 'EMPLOYEE_DEALLOCATED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  WORK_PROGRESS = 'WORK_PROGRESS',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_MADE = 'PAYMENT_MADE',
}
