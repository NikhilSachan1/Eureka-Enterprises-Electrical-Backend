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
 * Employee query only:
 * - `$8` true to list every employee, allocated or not (no project chosen)
 * - `$9` the system bot's user id, never listed
 *
 * Project query only:
 * - `$8` true to list every project in scope, allocated or not (no project chosen)
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

/**
 * One row per employee; people on a project now come first.
 *
 * With `$8` (no project chosen) every employee is listed — the same people as the employee
 * list (not system users), active or archived, whether or not they were ever allocated — so a
 * free person shows with zero days. Otherwise only people with an allocation in scope are listed.
 *
 * `freeDays`: days in the employee's working window with no allocation on any project. The window
 * runs from joining (else the first allocation) to exit (else today), clipped to the period. A day
 * on two projects counts once, and days on other projects are never free even when one project is
 * chosen. NULL when there is no start to count from.
 */
export const employeeAllocationSummaryQuery = `
  WITH ${SCOPED_ALLOCATIONS},
  people AS (
    SELECT DISTINCT sc."userId" AS id FROM scoped sc
    UNION
    SELECT u.id
    FROM users u
    WHERE $8::boolean
      AND u."deletedAt" IS NULL
      AND u."isSystemUser" = false
      AND u.id <> $9::uuid
  )
  SELECT
    u.id AS "userId",
    u."firstName",
    u."lastName",
    u."employeeId",
    u."status",
    COUNT(sc.id)::int AS "allocationCount",
    COUNT(DISTINCT sc."siteId")::int AS "projectCount",
    -- GREATEST skips NULLs, so a person with no allocation must be counted as 0 explicitly.
    COALESCE(SUM(CASE WHEN sc.id IS NULL THEN 0 ELSE ${DAYS_IN_PERIOD} END), 0)::int AS "allocatedDays",
    to_char(${LAST_CHANGE}, 'YYYY-MM-DD') AS "lastChange",
    COALESCE(cur.sites, '[]'::jsonb) AS "currentSites",
    CASE
      WHEN win.from_day IS NULL THEN NULL
      ELSE GREATEST((win.to_day - win.from_day + 1) - COALESCE(cov.days, 0), 0)
    END::int AS "freeDays",
    COUNT(*) OVER ()::int AS "totalRecords"
  FROM people p
  INNER JOIN users u ON u.id = p.id
  LEFT JOIN scoped sc ON sc."userId" = u.id
  -- The employee's working window, clipped to the period.
  LEFT JOIN LATERAL (
    SELECT
      GREATEST(base.start_day, COALESCE($2::date, base.start_day)) AS from_day,
      LEAST(
        COALESCE(u."exitDate"::date, CURRENT_DATE),
        CURRENT_DATE,
        COALESCE($3::date, DATE '9999-12-31')
      ) AS to_day
    FROM (
      SELECT COALESCE(
        u."dateOfJoining"::date,
        (SELECT MIN(fa."allocatedAt") FROM site_allocations fa
          WHERE fa."userId" = u.id AND fa."deletedAt" IS NULL)
      ) AS start_day
    ) base
  ) win ON true
  -- Distinct days on any project inside the window.
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT d)::int AS days
    FROM site_allocations a,
      generate_series(
        GREATEST(a."allocatedAt", win.from_day),
        LEAST(COALESCE(a."deallocatedAt", CURRENT_DATE), win.to_day),
        interval '1 day'
      ) d
    WHERE a."userId" = u.id AND a."deletedAt" IS NULL AND win.from_day IS NOT NULL
  ) cov ON true
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
  GROUP BY u.id, cur.sites, win.from_day, win.to_day, cov.days
  ORDER BY (cur.sites IS NOT NULL) DESC, (u."status" = 'ACTIVE') DESC, u."firstName", u."lastName"
  LIMIT $5 OFFSET $6
`;

/**
 * One row per project; most recently changed first, never-staffed projects last.
 *
 * With `$8` (no project chosen) every project in scope is listed, staffed or not; otherwise only
 * projects with an allocation in scope.
 */
export const projectAllocationSummaryQuery = `
  WITH ${SCOPED_ALLOCATIONS}
  SELECT
    s.id AS "siteId",
    s.name,
    s.city,
    s.state,
    COUNT(sc.id)::int AS "allocationCount",
    COUNT(DISTINCT sc."userId")::int AS "totalPeople",
    COALESCE(cur.people, 0)::int AS "currentPeople",
    to_char(MIN(sc."allocatedAt"), 'YYYY-MM-DD') AS "firstAllocation",
    to_char(${LAST_CHANGE}, 'YYYY-MM-DD') AS "lastChange",
    COUNT(*) OVER ()::int AS "totalRecords"
  FROM sites s
  LEFT JOIN scoped sc ON sc."siteId" = s.id
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT ca."userId") AS people
    FROM site_allocations ca
    WHERE ca."siteId" = s.id
      AND ca."deletedAt" IS NULL
      AND ca."isCurrentlyAllocated" = true
  ) cur ON true
  WHERE s."deletedAt" IS NULL
    AND ($1::uuid[] IS NULL OR s.id = ANY($1::uuid[]))
    AND ($7::uuid[] IS NULL OR s.id = ANY($7::uuid[]))
    AND ($4::text IS NULL OR s.name ILIKE $4::text)
    AND ($8::boolean OR sc.id IS NOT NULL)
  GROUP BY s.id, cur.people
  ORDER BY ${LAST_CHANGE} DESC NULLS LAST, s.name
  LIMIT $5 OFFSET $6
`;
