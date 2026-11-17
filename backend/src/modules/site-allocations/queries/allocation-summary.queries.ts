/**
 * Allocation history rolled up per employee and per project, one page at a time.
 *
 * Shared parameters (both queries):
 * - `$1` site ids in scope (readable sites, narrowed to the requested project), NULL = every site
 * - `$2` period start, `$3` period end (NULL = unbounded); an allocation is in scope when it
 *   overlaps the period (inclusive on both ends, an open end runs on)
 * - `$4` search pattern for `ILIKE` (NULL = no search)
 * - `$5` page size, `$6` offset
 * - `$7` readable site ids for the "right now" figures, NULL = every site; these ignore the
 *   period and the requested project so they always show where people are today
 *
 * Day counts are clipped to the period and run to today for an open allocation; a backwards range
 * (deallocatedAt < allocatedAt, which exists in old data) counts as zero days.
 * Dates are returned as `YYYY-MM-DD` text so no time zone can shift them.
 */

const SCOPED_ALLOCATIONS = `
  scoped AS (
    SELECT sa.*
    FROM site_allocations sa
    INNER JOIN sites s ON s.id = sa."siteId" AND s."deletedAt" IS NULL
    WHERE sa."deletedAt" IS NULL
      AND ($1::uuid[] IS NULL OR sa."siteId" = ANY($1::uuid[]))
      AND ($2::date IS NULL OR sa."deallocatedAt" IS NULL OR sa."deallocatedAt" >= $2::date)
      AND ($3::date IS NULL OR sa."allocatedAt" <= $3::date)
  )
`;

const DAYS_IN_PERIOD = `
  GREATEST(
    LEAST(COALESCE(sc."deallocatedAt", CURRENT_DATE), COALESCE($3::date, DATE '9999-12-31'))
    - GREATEST(sc."allocatedAt", COALESCE($2::date, DATE '0001-01-01'))
    + 1,
    0
  )
`;

const LAST_CHANGE = `GREATEST(MAX(sc."allocatedAt"), MAX(sc."deallocatedAt"))`;

/** One row per employee with an allocation in scope; people on a project now come first. */
export const employeeAllocationSummaryQuery = `
  WITH ${SCOPED_ALLOCATIONS}
  SELECT
    u.id AS "userId",
    u."firstName",
    u."lastName",
    u."employeeId",
    COUNT(*)::int AS "allocationCount",
    COUNT(DISTINCT sc."siteId")::int AS "projectCount",
    SUM(${DAYS_IN_PERIOD})::int AS "allocatedDays",
    to_char(${LAST_CHANGE}, 'YYYY-MM-DD') AS "lastChange",
    COALESCE(cur.sites, '[]'::jsonb) AS "currentSites",
    COUNT(*) OVER ()::int AS "totalRecords"
  FROM scoped sc
  INNER JOIN users u ON u.id = sc."userId"
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object('id', cs.id, 'name', cs.name, 'city', cs.city, 'state', cs.state)
      ORDER BY cs.name
    ) AS sites
    FROM site_allocations ca
    INNER JOIN sites cs ON cs.id = ca."siteId" AND cs."deletedAt" IS NULL
    WHERE ca."userId" = u.id
      AND ca."deletedAt" IS NULL
      AND ca."isCurrentlyAllocated" = true
      AND ($7::uuid[] IS NULL OR ca."siteId" = ANY($7::uuid[]))
  ) cur ON true
  WHERE $4::text IS NULL
    OR (u."firstName" || ' ' || u."lastName") ILIKE $4::text
    OR u."employeeId" ILIKE $4::text
  GROUP BY u.id, cur.sites
  ORDER BY (cur.sites IS NOT NULL) DESC, u."firstName", u."lastName"
  LIMIT $5 OFFSET $6
`;

/** One row per project with an allocation in scope; most recently changed first. */
export const projectAllocationSummaryQuery = `
  WITH ${SCOPED_ALLOCATIONS}
  SELECT
    s.id AS "siteId",
    s.name,
    s.city,
    s.state,
    COUNT(*)::int AS "allocationCount",
    COUNT(DISTINCT sc."userId")::int AS "totalPeople",
    COALESCE(cur.people, 0)::int AS "currentPeople",
    to_char(MIN(sc."allocatedAt"), 'YYYY-MM-DD') AS "firstAllocation",
    to_char(${LAST_CHANGE}, 'YYYY-MM-DD') AS "lastChange",
    COUNT(*) OVER ()::int AS "totalRecords"
  FROM scoped sc
  INNER JOIN sites s ON s.id = sc."siteId"
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT ca."userId") AS people
    FROM site_allocations ca
    WHERE ca."siteId" = s.id
      AND ca."deletedAt" IS NULL
      AND ca."isCurrentlyAllocated" = true
  ) cur ON true
  WHERE ($7::uuid[] IS NULL OR s.id = ANY($7::uuid[]))
    AND ($4::text IS NULL OR s.name ILIKE $4::text)
  GROUP BY s.id, cur.people
  ORDER BY ${LAST_CHANGE} DESC NULLS LAST, s.name
  LIMIT $5 OFFSET $6
`;
