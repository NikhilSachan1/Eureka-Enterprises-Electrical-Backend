/**
 * How well each project reports its DSRs, one page at a time.
 *
 * A day is "expected" when someone was allocated to the project that day (every day is a working
 * day). It is "reported" when at least one current DSR exists for the project that day, and
 * "missing" when it was expected but nothing came in. Only the current version of a DSR counts.
 *
 * Parameters:
 * - `$1` site ids in scope (readable sites, narrowed to the requested project), NULL = every site
 * - `$2` period start, `$3` period end (NULL = unbounded; days never run past today)
 * - `$4` project name pattern for `ILIKE` (NULL = no search)
 * - `$5` page size, `$6` offset
 * - `$7` true to list every project in scope, even with no allocation or DSR (no project, no dates)
 * - `$8` one person's id: count only their allocations and DSRs, NULL = everyone
 *
 * Dates are returned as `YYYY-MM-DD` text so no time zone can shift them.
 */

/**
 * Last day of an allocation: its deallocation date; today while it runs; for old ended rows with
 * no deallocation date, their last change. Same rule as the allocation summaries.
 */
const ALLOCATION_END = `
  COALESCE(
    sa."deallocatedAt",
    CASE WHEN sa."isCurrentlyAllocated" THEN CURRENT_DATE ELSE sa."updatedAt"::date END,
    sa."allocatedAt"
  )
`;

export const dsrProjectSummaryQuery = `
  WITH sites_in AS (
    SELECT s.id, s.name, s.city, s.state, s.status
    FROM sites s
    WHERE s."deletedAt" IS NULL
      AND ($1::uuid[] IS NULL OR s.id = ANY($1::uuid[]))
      AND ($4::text IS NULL OR s.name ILIKE $4::text)
  ),
  expected_days AS (
    SELECT DISTINCT sa."siteId", d::date AS day
    FROM site_allocations sa
    INNER JOIN sites_in si ON si.id = sa."siteId"
    CROSS JOIN LATERAL generate_series(
      GREATEST(sa."allocatedAt", COALESCE($2::date, sa."allocatedAt")),
      LEAST(${ALLOCATION_END}, CURRENT_DATE, COALESCE($3::date, CURRENT_DATE)),
      interval '1 day'
    ) d
    WHERE sa."deletedAt" IS NULL
      AND ($8::uuid IS NULL OR sa."userId" = $8::uuid)
  ),
  reports AS (
    SELECT r."siteId", r."reportDate"::date AS day, r."userId"
    FROM daily_status_reports r
    INNER JOIN sites_in si ON si.id = r."siteId"
    WHERE r."deletedAt" IS NULL
      AND r."isActive" = true
      AND r."reportDate" <= CURRENT_DATE
      AND ($2::date IS NULL OR r."reportDate" >= $2::date)
      AND ($3::date IS NULL OR r."reportDate" <= $3::date)
      AND ($8::uuid IS NULL OR r."userId" = $8::uuid)
  ),
  per_site AS (
    SELECT
      si.id,
      (SELECT COUNT(*) FROM expected_days e WHERE e."siteId" = si.id)::int AS expected,
      (SELECT COUNT(*) FROM expected_days e
        WHERE e."siteId" = si.id
          AND EXISTS (SELECT 1 FROM reports r WHERE r."siteId" = e."siteId" AND r.day = e.day)
      )::int AS reported,
      (SELECT COUNT(*) FROM reports r WHERE r."siteId" = si.id)::int AS report_count,
      (SELECT COUNT(DISTINCT r."userId") FROM reports r WHERE r."siteId" = si.id)::int AS reporters,
      (SELECT MAX(r.day) FROM reports r WHERE r."siteId" = si.id) AS last_report
    FROM sites_in si
  )
  SELECT
    si.id AS "siteId",
    si.name,
    si.city,
    si.state,
    si.status,
    ps.expected AS "expectedDays",
    ps.reported AS "reportedDays",
    (ps.expected - ps.reported) AS "missingDays",
    ps.report_count AS "reportCount",
    ps.reporters AS "reporters",
    to_char(ps.last_report, 'YYYY-MM-DD') AS "lastReportDate",
    COUNT(*) OVER ()::int AS "totalRecords"
  FROM sites_in si
  INNER JOIN per_site ps ON ps.id = si.id
  WHERE $7::boolean OR ps.expected > 0 OR ps.report_count > 0
  ORDER BY (ps.expected - ps.reported) DESC, ps.last_report ASC NULLS LAST, si.name
  LIMIT $5 OFFSET $6
`;
