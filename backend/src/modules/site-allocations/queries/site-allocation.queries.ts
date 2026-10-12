/**
 * Allocation date-range queries.
 *
 * An allocation covers `allocatedAt` to `deallocatedAt` **inclusive** on both ends — allocating and
 * de-allocating on the same day means that day was worked, which is how the business reads it and
 * why a same-day de-allocation never erased anything. Everything below assumes that.
 *
 * An open end (`deallocatedAt IS NULL`) means "until further notice", so it is treated as running
 * to the far future rather than as a one-day allocation.
 */

/** The far-future stand-in for an open-ended allocation. */
export const OPEN_END = `DATE '9999-12-31'`;

/**
 * Allocations of the same user whose dates clash with a given range.
 *
 * `$1` userId, `$2` range start, `$3` range end (NULL = open-ended), `$4` allocation id to ignore
 * (the row being edited; NULL when creating).
 *
 * Rows with a backwards range (`deallocatedAt < allocatedAt`) cover no day at all, so they can
 * clash with nothing and drop out by themselves. There are such rows in the data and they are
 * deliberately left alone for now.
 */
export const overlappingAllocationsQuery = `
  SELECT
    sa.id,
    sa."siteId",
    s.name AS "siteName",
    sa."allocatedAt",
    sa."deallocatedAt",
    -- How many days the two ranges share. Used to tell a clash that got worse from one that did
    -- not, so an existing clash can still be edited down to nothing.
    (
      LEAST(COALESCE(sa."deallocatedAt", ${OPEN_END}), COALESCE($3::date, ${OPEN_END}))
      - GREATEST(sa."allocatedAt", $2::date)
      + 1
    ) AS "overlapDays"
  FROM site_allocations sa
  INNER JOIN sites s ON s.id = sa."siteId" AND s."deletedAt" IS NULL
  WHERE sa."userId" = $1
    AND sa."deletedAt" IS NULL
    AND ($4::uuid IS NULL OR sa.id <> $4::uuid)
    AND sa."allocatedAt" <= COALESCE(sa."deallocatedAt", ${OPEN_END})
    AND sa."allocatedAt" <= COALESCE($3::date, ${OPEN_END})
    AND $2::date <= COALESCE(sa."deallocatedAt", ${OPEN_END})
  ORDER BY sa."allocatedAt"
`;

/**
 * The open-ended allocations a new one would run into.
 *
 * These are closed automatically the day before the new allocation starts: an open end means
 * "until further notice", and a transfer *is* that notice. Without this every transfer would be a
 * two-step job, and the clash check would refuse the second step.
 *
 * `$1` userId, `$2` the new allocation's start date.
 */
export const openEndedAllocationsBeforeQuery = `
  SELECT sa.id, sa."allocatedAt", s.name AS "siteName"
    FROM site_allocations sa
    INNER JOIN sites s ON s.id = sa."siteId" AND s."deletedAt" IS NULL
   WHERE sa."userId" = $1
     AND sa."deletedAt" IS NULL
     AND sa."deallocatedAt" IS NULL
     AND sa."allocatedAt" < $2::date
`;

/**
 * Attendance days recorded against this user inside an allocation's dates.
 *
 * Deleting the allocation leaves those days with no project to show, so the count is surfaced
 * before the delete rather than discovered afterwards.
 *
 * `$1` userId, `$2` start, `$3` end (NULL = open-ended).
 */
export const attendanceDaysInRangeQuery = `
  SELECT COUNT(*)::int AS days
    FROM attendances a
   WHERE a."userId" = $1
     AND a."deletedAt" IS NULL
     AND a."attendanceDate" >= $2::date
     AND a."attendanceDate" <= COALESCE($3::date, ${OPEN_END})
`;

/**
 * Months inside an allocation's dates for which this user's payroll already exists.
 *
 * The allocation carries the daily allowance, so deleting one after its month has been paid would
 * leave the payslip and the record disagreeing about where the person was.
 *
 * `$1` userId, `$2` start, `$3` end (NULL = open-ended).
 */
export const generatedPayrollMonthsInRangeQuery = `
  SELECT p.month, p.year
    FROM payroll p
   WHERE p."userId" = $1
     AND p."deletedAt" IS NULL
     AND p.status <> 'CANCELLED'
     AND make_date(p.year, p.month, 1)
         <= date_trunc('month', COALESCE($3::date, ${OPEN_END}))::date
     AND (make_date(p.year, p.month, 1) + INTERVAL '1 month - 1 day')::date
         >= date_trunc('month', $2::date)::date
   ORDER BY p.year, p.month
`;
