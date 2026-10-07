/**
 * The site an employee was allocated to on a given day.
 *
 * Deliberately **not** read from `assignmentSnapshot`. The snapshot freezes whatever was true at
 * check-in, so correcting an allocation afterwards would leave every attendance of those days
 * still pointing at the old project until someone went back and edited each one. Resolving from
 * the allocation means a correction lands everywhere at once, which is what was asked for.
 *
 * Matching is by date range, inclusive at both ends, with an open end meaning "until further
 * notice". The newest allocation wins if two somehow cover the same day — there are overlapping
 * rows in existing data, and a list must not return a different project each time it is read.
 */

/** Columns the attendance screens show for a site. Kept in one place so they cannot drift apart. */
export const SITE_FIELDS = `
  s."id", s."name", s."fullAddress", s."city", s."state", s."pincode",
  s."status", s."startDate", s."managerName"
`;

/**
 * A correlated sub-select returning the allocated site for one attendance row, as JSON.
 *
 * Written as a LATERAL join rather than a per-row lookup so a month of attendance for a whole
 * team stays one query.
 *
 * `userAlias`/`dateAlias` name the columns to match against, e.g. `a."userId"` and
 * `a."attendanceDate"`.
 */
export const allocatedSiteLateral = (userCol: string, dateCol: string) => `
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object(
             'id', s."id",
             'name', s."name",
             'fullAddress', s."fullAddress",
             'city', s."city",
             'state', s."state",
             'pincode', s."pincode",
             'status', s."status",
             'startDate', s."startDate",
             'managerName', s."managerName"
           ) AS site
      FROM site_allocations sa
      INNER JOIN sites s ON s."id" = sa."siteId" AND s."deletedAt" IS NULL
     WHERE sa."userId" = ${userCol}
       AND sa."deletedAt" IS NULL
       AND sa."allocatedAt" <= ${dateCol}
       AND (sa."deallocatedAt" IS NULL OR sa."deallocatedAt" >= ${dateCol})
     ORDER BY sa."allocatedAt" DESC, sa."createdAt" DESC
     LIMIT 1
  ) alloc_site ON TRUE
`;

/**
 * The same lookup for a single employee and day — for the paths that handle one record.
 *
 * `$1` userId, `$2` the date.
 */
export const allocatedSiteForDayQuery = `
  SELECT ${SITE_FIELDS}
    FROM site_allocations sa
    INNER JOIN sites s ON s."id" = sa."siteId" AND s."deletedAt" IS NULL
   WHERE sa."userId" = $1
     AND sa."deletedAt" IS NULL
     AND sa."allocatedAt" <= $2::date
     AND (sa."deallocatedAt" IS NULL OR sa."deallocatedAt" >= $2::date)
   ORDER BY sa."allocatedAt" DESC, sa."createdAt" DESC
   LIMIT 1
`;
