/**
 * Queries behind `/dashboard/me/*` — the same dashboard as the admin one, seen from one desk.
 *
 * Every query here takes the caller's own id and answers only about them. That is the whole
 * security model for these endpoints: there is no `userId` parameter to tamper with, so there is
 * no permission to check beyond being logged in.
 *
 * Where a figure also exists on the admin dashboard it is computed the same way, so the two can be
 * put side by side without explaining a difference. Where the admin side left a TODO stub
 * (`lateArrivals: 0`, `totalWorkingDays: 22`) nothing is copied — a figure that is wrong on one
 * screen should not be wrong on two.
 */

/** Attendance statuses that mean the day was worked, for the "days worked" count. */
const WORKED = `('present', 'checkedIn', 'checkedOut', 'approvalPending')`;

// ──────────────────────────────── attendance ────────────────────────────────

/**
 * My attendance row for one date, with the project resolved from the allocation.
 *
 * The project is not read from `assignmentSnapshot` — it is resolved for the date, exactly as the
 * attendance list does it, so the dashboard and the attendance screen cannot disagree.
 *
 * `$1` userId, `$2` date.
 */
export const myDayAttendanceQuery = `
  SELECT
    a."id",
    a."status",
    a."approvalStatus",
    a."checkInTime",
    a."checkOutTime",
    a."attendanceType",
    alloc."siteName",
    alloc."siteId"
  FROM attendances a
  LEFT JOIN LATERAL (
    SELECT s."id" AS "siteId", s."name" AS "siteName"
      FROM site_allocations sa
      JOIN sites s ON s."id" = sa."siteId" AND s."deletedAt" IS NULL
     WHERE sa."userId" = a."userId"
       AND sa."deletedAt" IS NULL
       AND sa."allocatedAt" <= a."attendanceDate"
       AND (sa."deallocatedAt" IS NULL OR sa."deallocatedAt" >= a."attendanceDate")
     ORDER BY sa."allocatedAt" DESC, sa."createdAt" DESC
     LIMIT 1
  ) alloc ON TRUE
  WHERE a."userId" = $1
    AND a."attendanceDate" = $2::date
    AND a."isActive" = true
    AND a."deletedAt" IS NULL
  LIMIT 1
`;

/**
 * My attendance counted by status over a date range.
 *
 * `daysRecorded` is the honest denominator: how many days actually have a row, rather than a
 * working-day figure nothing computes yet.
 *
 * `$1` userId, `$2` start, `$3` end.
 */
export const myAttendanceCountsQuery = `
  SELECT
    COUNT(*)::int                                                              AS "daysRecorded",
    COUNT(*) FILTER (WHERE status IN ${WORKED})::int                           AS "worked",
    COUNT(*) FILTER (WHERE status = 'present')::int                            AS "present",
    COUNT(*) FILTER (WHERE status = 'absent')::int                             AS "absent",
    COUNT(*) FILTER (WHERE status IN ('leave', 'leaveWithoutPay'))::int        AS "onLeave",
    COUNT(*) FILTER (WHERE status = 'halfDay')::int                            AS "halfDay",
    COUNT(*) FILTER (WHERE status = 'holiday')::int                            AS "holiday",
    COUNT(*) FILTER (WHERE "approvalStatus" = 'pending')::int                  AS "approvalPending"
  FROM attendances
  WHERE "userId" = $1
    AND "attendanceDate" >= $2::date
    AND "attendanceDate" <= $3::date
    AND "isActive" = true
    AND "deletedAt" IS NULL
`;

// ──────────────────────────────── leave ────────────────────────────────

/**
 * My leave balance per category for a financial year.
 *
 * `balance` is `totalAllocated - consumed`, which is what the mobile dashboard shows. It is not
 * the sum of all four columns, even though `carriedForward` and `adjusted` are sitting right
 * there: an employee reading one number on the phone and a different one on the web would be
 * worse than a formula that can be argued with. Both are returned so the screen can show the
 * working, and if the formula is ever corrected it must be corrected in both places together.
 *
 * The four columns are varchar in this schema, hence the casts — SUM() refuses them otherwise.
 *
 * Rows are grouped because a category can be credited from more than one source.
 *
 * `$1` userId, `$2` financial year.
 */
export const myLeaveBalancesQuery = `
  SELECT
    "leaveCategory",
    COALESCE(SUM("totalAllocated"::numeric), 0)::float AS "totalAllocated",
    COALESCE(SUM("consumed"::numeric), 0)::float       AS "consumed",
    COALESCE(SUM("carriedForward"::numeric), 0)::float AS "carriedForward",
    COALESCE(SUM("adjusted"::numeric), 0)::float       AS "adjusted",
    (COALESCE(SUM("totalAllocated"::numeric), 0)
     - COALESCE(SUM("consumed"::numeric), 0))::float   AS "balance"
  FROM leave_balances
  WHERE "userId" = $1
    AND "financialYear" = $2
    AND "deletedAt" IS NULL
  GROUP BY "leaveCategory"
  ORDER BY "leaveCategory"
`;

/**
 * My leave applications still waiting on someone, and the approved ones still to come.
 *
 * `$1` userId, `$2` today.
 */
export const myLeaveApplicationsQuery = `
  SELECT
    COUNT(*) FILTER (WHERE "approvalStatus" = 'pending')::int AS "pendingCount",
    COUNT(*) FILTER (
      WHERE "approvalStatus" = 'approved' AND "fromDate" >= $2::date
    )::int AS "upcomingApprovedCount",
    COALESCE(
      SUM(("toDate"::date - "fromDate"::date + 1))
      FILTER (WHERE "approvalStatus" = 'approved' AND "fromDate" >= $2::date), 0
    )::int AS "upcomingApprovedDays",
    MIN("fromDate") FILTER (
      WHERE "approvalStatus" = 'approved' AND "fromDate" >= $2::date
    ) AS "nextLeaveFrom"
  FROM leave_applications
  WHERE "userId" = $1
    AND "deletedAt" IS NULL
`;

// ──────────────────────────────── money ────────────────────────────────

/**
 * What the company still owes me.
 *
 * Deliberately the same expression as the pending-settlement screen — approved debits minus every
 * credit — so an employee cannot see one figure here and another there.
 *
 * `$1` userId.
 */
export const myPendingSettlementQuery = `
  SELECT
    COALESCE(SUM(CASE WHEN "transactionType" = 'debit' AND "approvalStatus" = 'approved'
                 THEN amount::numeric ELSE 0 END), 0)::float AS "approved",
    COALESCE(SUM(CASE WHEN "transactionType" = 'credit'
                 THEN amount::numeric ELSE 0 END), 0)::float AS "settled"
  FROM expenses
  WHERE "userId" = $1
    AND "isActive" = true
    AND "deletedAt" IS NULL
`;

/**
 * My expense claims over a date range, counted and totalled by where they have got to.
 *
 * Credits are excluded: they are the company paying me back, not a claim I raised.
 *
 * `$1` userId, `$2` start, `$3` end.
 */
export const myExpenseSummaryQuery = `
  SELECT
    COUNT(*)::int                                                   AS "claims",
    COALESCE(SUM(amount::numeric), 0)::float                        AS "total",
    COUNT(*) FILTER (WHERE "approvalStatus" = 'pending')::int       AS "pendingCount",
    COALESCE(SUM(amount::numeric) FILTER (WHERE "approvalStatus" = 'pending'), 0)::float
                                                                    AS "pendingAmount",
    COUNT(*) FILTER (WHERE "approvalStatus" = 'approved')::int      AS "approvedCount",
    COALESCE(SUM(amount::numeric) FILTER (WHERE "approvalStatus" = 'approved'), 0)::float
                                                                    AS "approvedAmount",
    COUNT(*) FILTER (WHERE "approvalStatus" = 'rejected')::int      AS "rejectedCount",
    COALESCE(SUM(amount::numeric) FILTER (WHERE "approvalStatus" = 'rejected'), 0)::float
                                                                    AS "rejectedAmount"
  FROM expenses
  WHERE "userId" = $1
    AND "transactionType" = 'debit'
    AND "isActive" = true
    AND "deletedAt" IS NULL
    AND "expenseDate" >= $2::date
    AND "expenseDate" <= $3::date
`;

/**
 * My claims by category over a date range — numbers only, no chart payload.
 *
 * `$1` userId, `$2` start, `$3` end.
 */
export const myExpenseByCategoryQuery = `
  SELECT category, COUNT(*)::int AS count, COALESCE(SUM(amount::numeric), 0)::float AS amount
  FROM expenses
  WHERE "userId" = $1
    AND "transactionType" = 'debit'
    AND "isActive" = true
    AND "deletedAt" IS NULL
    AND "expenseDate" >= $2::date
    AND "expenseDate" <= $3::date
  GROUP BY category
  ORDER BY amount DESC
`;

/**
 * A driver's attendance food allowance for a date range.
 *
 * Not simply "expenses in the fooding category" — a driver can also claim fooding by hand, and a
 * redirected allowance writes three rows, not one: the driver gets a debit (earned) and a matching
 * credit (redirected) so his own ledger nets to zero, and the engineer gets the money. The
 * reference id in `transactionId` is what tells the three apart, and it is the same handle the
 * re-routing code reverses by.
 *
 *   ATT_FOOD_<driver>_<date>        kept by the driver
 *   ATT_FOOD_EARN_<driver>_<date>   earned, but redirected to an engineer
 *   ATT_FOOD_REV*                   a reversal, excluded here
 *
 * Underscores are escaped because they are single-character wildcards in LIKE, and every one of
 * these ids is full of them.
 *
 * `$1` userId, `$2` start, `$3` end.
 */
export const myFoodAllowanceQuery = `
  WITH mine AS (
    SELECT e."transactionId", e."amount"::numeric AS amount
      FROM expenses e
     WHERE e."userId" = $1
       AND e."isActive" = true
       AND e."deletedAt" IS NULL
       AND e."expenseDate" >= $2::date
       AND e."expenseDate" <= $3::date
       AND e."transactionId" NOT LIKE 'ATT\\_FOOD\\_REV%'
  )
  SELECT
    (SELECT COUNT(*)::int FROM mine
      WHERE "transactionId" LIKE 'ATT\\_FOOD\\_' || $1 || '\\_%')          AS "keptDays",
    (SELECT COALESCE(SUM(amount), 0)::float FROM mine
      WHERE "transactionId" LIKE 'ATT\\_FOOD\\_' || $1 || '\\_%')          AS "keptAmount",
    (SELECT COUNT(*)::int FROM mine
      WHERE "transactionId" LIKE 'ATT\\_FOOD\\_EARN\\_' || $1 || '\\_%')  AS "redirectedDays",
    (SELECT COALESCE(SUM(amount), 0)::float FROM mine
      WHERE "transactionId" LIKE 'ATT\\_FOOD\\_EARN\\_' || $1 || '\\_%')  AS "redirectedAmount",
    (SELECT COUNT(*)::int
       FROM driver_day_assignments da
      WHERE da."driverId" = $1
        AND da."deletedAt" IS NULL
        AND da."workDate" >= $2::date
        AND da."workDate" <= $3::date)                                     AS "pairedDays"
`;

/** The engineers a driver was paired with this month, with how many days each. `$1` `$2` `$3`. */
export const myPairedEngineersQuery = `
  SELECT
    u."id",
    TRIM(CONCAT_WS(' ', u."firstName", u."lastName")) AS "name",
    u."employeeId",
    COUNT(*)::int AS "days"
  FROM driver_day_assignments da
  JOIN users u ON u."id" = da."engineerId" AND u."deletedAt" IS NULL
  WHERE da."driverId" = $1
    AND da."deletedAt" IS NULL
    AND da."workDate" >= $2::date
    AND da."workDate" <= $3::date
  GROUP BY u."id", u."firstName", u."lastName", u."employeeId"
  ORDER BY "days" DESC
`;

// ──────────────────────────────── project ────────────────────────────────

/** Where I am today, and since when. `$1` userId, `$2` today. */
export const myCurrentProjectQuery = `
  SELECT
    s."id", s."name", s."fullAddress", s."city", s."state", s."managerName", s."status",
    sa."allocatedAt" AS "since",
    sa."deallocatedAt" AS "until",
    sa."role",
    sa."dailyAllowance"
  FROM site_allocations sa
  JOIN sites s ON s."id" = sa."siteId" AND s."deletedAt" IS NULL
  WHERE sa."userId" = $1
    AND sa."deletedAt" IS NULL
    AND sa."allocatedAt" <= $2::date
    AND (sa."deallocatedAt" IS NULL OR sa."deallocatedAt" >= $2::date)
  ORDER BY sa."allocatedAt" DESC, sa."createdAt" DESC
  LIMIT 1
`;

/** Every project I have been on, newest first. `$1` userId, `$2` limit. */
export const myProjectHistoryQuery = `
  SELECT
    s."id", s."name", s."city",
    sa."allocatedAt" AS "from",
    sa."deallocatedAt" AS "to",
    sa."role"
  FROM site_allocations sa
  JOIN sites s ON s."id" = sa."siteId" AND s."deletedAt" IS NULL
  WHERE sa."userId" = $1
    AND sa."deletedAt" IS NULL
  ORDER BY sa."allocatedAt" DESC, sa."createdAt" DESC
  LIMIT $2
`;

// ──────────────────────────────── assets ────────────────────────────────

/** The assets I am holding, with the dates that decide whether they are in order. `$1` userId. */
export const myAssetsQuery = `
  SELECT
    am."id", am."assetId",
    av."name", av."model", av."category", av."assetType", av."status",
    av."calibrationEndDate", av."warrantyEndDate"
  FROM asset_versions av
  JOIN asset_masters am ON am."id" = av."assetMasterId" AND am."deletedAt" IS NULL
  WHERE av."assignedTo" = $1
    AND av."isActive" = true
    AND av."deletedAt" IS NULL
  ORDER BY am."assetId"
`;

/**
 * Handovers waiting on me to accept.
 *
 * An offer counts only while it is still the latest word on that asset — accepting, rejecting or
 * cancelling all write a later event, so the newest one being `HANDOVER_INITIATED` is exactly what
 * "still pending" means. Derived rather than flagged, so there is no state to leave stale.
 *
 * `$1` userId.
 */
export const myPendingAssetHandoversQuery = `
  SELECT
    am."id", am."assetId", av."name",
    last."createdAt" AS "offeredAt",
    TRIM(CONCAT_WS(' ', fu."firstName", fu."lastName")) AS "offeredBy"
  FROM asset_masters am
  JOIN LATERAL (
    SELECT ae."eventType", ae."toUser", ae."fromUser", ae."createdAt"
      FROM assets_events ae
     WHERE ae."assetMasterId" = am."id" AND ae."deletedAt" IS NULL
     ORDER BY ae."createdAt" DESC
     LIMIT 1
  ) last ON TRUE
  LEFT JOIN asset_versions av
    ON av."assetMasterId" = am."id" AND av."isActive" = true AND av."deletedAt" IS NULL
  LEFT JOIN users fu ON fu."id" = last."fromUser"
  WHERE am."deletedAt" IS NULL
    AND last."eventType" = 'HANDOVER_INITIATED'
    AND last."toUser" = $1
  ORDER BY last."createdAt"
`;

// ──────────────────────────────── vehicle ────────────────────────────────

/** The vehicle I hold today and the dates that expire on it. `$1` userId. */
export const myVehicleQuery = `
  SELECT
    vm."id", vm."registrationNo",
    vv."brand", vv."model", vv."fuelType", vv."status",
    vv."insuranceEndDate", vv."pucEndDate", vv."fitnessEndDate",
    vv."lastServiceKm", vv."lastServiceDate",
    -- The highest reading anyone has recorded, from the three places readings come from. Same
    -- expression the vehicle module uses for its own "current odometer", so the driver's card and
    -- the vehicle screen cannot disagree. Rejected fuel entries are left out: a reading nobody
    -- accepted should not move the meter.
    COALESCE(
      GREATEST(
        (SELECT MAX("odometerKm") FROM fuel_expenses
          WHERE "vehicleId" = vm."id" AND "deletedAt" IS NULL AND "isActive" = true
            AND "approvalStatus" <> 'rejected'),
        (SELECT MAX("odometerReading") FROM vehicle_services
          WHERE "vehicleMasterId" = vm."id" AND "deletedAt" IS NULL),
        (SELECT GREATEST(MAX("startOdometerReading"), MAX("endOdometerReading"))
           FROM vehicle_logs WHERE "vehicleId" = vm."id" AND "deletedAt" IS NULL)
      ), 0
    )::int AS "currentOdometerKm"
  FROM vehicle_versions vv
  JOIN vehicle_masters vm ON vm."id" = vv."vehicleMasterId" AND vm."deletedAt" IS NULL
  WHERE vv."assignedTo" = $1
    AND vv."isActive" = true
    AND vv."deletedAt" IS NULL
  ORDER BY vm."registrationNo"
  LIMIT 1
`;

/** Vehicle handovers waiting on me. Same "latest event wins" rule as the asset one. `$1` userId. */
export const myPendingVehicleHandoversQuery = `
  SELECT
    vm."id", vm."registrationNo",
    last."createdAt" AS "offeredAt",
    TRIM(CONCAT_WS(' ', fu."firstName", fu."lastName")) AS "offeredBy"
  FROM vehicle_masters vm
  JOIN LATERAL (
    SELECT ve."eventType", ve."toUser", ve."fromUser", ve."createdAt"
      FROM vehicles_events ve
     WHERE ve."vehicleMasterId" = vm."id" AND ve."deletedAt" IS NULL
     ORDER BY ve."createdAt" DESC
     LIMIT 1
  ) last ON TRUE
  LEFT JOIN users fu ON fu."id" = last."fromUser"
  WHERE vm."deletedAt" IS NULL
    AND last."eventType" = 'HANDOVER_INITIATED'
    AND last."toUser" = $1
  ORDER BY last."createdAt"
`;

/**
 * Handovers I have sent that are still waiting on someone else.
 *
 * The mirror of the pending list: same "latest event wins" rule, read from the other side. Worth
 * showing because the sender is the one who has to chase it, and because a handover the receiver
 * never accepts eventually charges *them* a penalty — seeing it sit there is the warning.
 *
 * `$1` userId.
 */
export const myOutgoingAssetHandoversQuery = `
  SELECT
    am."id", am."assetId", av."name",
    last."createdAt" AS "offeredAt",
    TRIM(CONCAT_WS(' ', tu."firstName", tu."lastName")) AS "waitingOn"
  FROM asset_masters am
  JOIN LATERAL (
    SELECT ae."eventType", ae."toUser", ae."fromUser", ae."createdAt"
      FROM assets_events ae
     WHERE ae."assetMasterId" = am."id" AND ae."deletedAt" IS NULL
     ORDER BY ae."createdAt" DESC
     LIMIT 1
  ) last ON TRUE
  LEFT JOIN asset_versions av
    ON av."assetMasterId" = am."id" AND av."isActive" = true AND av."deletedAt" IS NULL
  LEFT JOIN users tu ON tu."id" = last."toUser"
  WHERE am."deletedAt" IS NULL
    AND last."eventType" = 'HANDOVER_INITIATED'
    AND last."fromUser" = $1
  ORDER BY last."createdAt"
`;

/** The same, for vehicles. `$1` userId. */
export const myOutgoingVehicleHandoversQuery = `
  SELECT
    vm."id", vm."registrationNo",
    last."createdAt" AS "offeredAt",
    TRIM(CONCAT_WS(' ', tu."firstName", tu."lastName")) AS "waitingOn"
  FROM vehicle_masters vm
  JOIN LATERAL (
    SELECT ve."eventType", ve."toUser", ve."fromUser", ve."createdAt"
      FROM vehicles_events ve
     WHERE ve."vehicleMasterId" = vm."id" AND ve."deletedAt" IS NULL
     ORDER BY ve."createdAt" DESC
     LIMIT 1
  ) last ON TRUE
  LEFT JOIN users tu ON tu."id" = last."toUser"
  WHERE vm."deletedAt" IS NULL
    AND last."eventType" = 'HANDOVER_INITIATED'
    AND last."fromUser" = $1
  ORDER BY last."createdAt"
`;

// ──────────────────────────────── fuel ────────────────────────────────

/**
 * My fuel entries for a date range — counts and amounts only, as asked.
 *
 * PetroCard is split out because that money comes from the company wallet rather than the
 * driver's own pocket, and the two should never be read as one figure.
 *
 * `$1` userId, `$2` start, `$3` end.
 */
export const myFuelSummaryQuery = `
  SELECT
    COUNT(*)::int                                                       AS "entries",
    COALESCE(SUM("fuelAmount"::numeric), 0)::float                      AS "amount",
    COALESCE(SUM("fuelLiters"::numeric), 0)::float                      AS "liters",
    COUNT(*) FILTER (WHERE "approvalStatus" = 'pending')::int           AS "pendingCount",
    COALESCE(SUM("fuelAmount"::numeric) FILTER (WHERE "approvalStatus" = 'pending'), 0)::float
                                                                        AS "pendingAmount",
    COUNT(*) FILTER (WHERE "approvalStatus" = 'approved')::int          AS "approvedCount",
    COUNT(*) FILTER (WHERE "approvalStatus" = 'rejected')::int          AS "rejectedCount",
    COUNT(*) FILTER (WHERE "paymentMode" = 'petro_card')::int           AS "petroCardCount",
    COALESCE(SUM("fuelAmount"::numeric) FILTER (WHERE "paymentMode" = 'petro_card'), 0)::float
                                                                        AS "petroCardAmount",
    COALESCE(SUM("fuelAmount"::numeric) FILTER (WHERE "paymentMode" <> 'petro_card'), 0)::float
                                                                        AS "ownPaidAmount"
  FROM fuel_expenses
  WHERE "userId" = $1
    AND "isActive" = true
    AND "deletedAt" IS NULL
    AND "fillDate" >= $2::date
    AND "fillDate" <= $3::date
`;

// ──────────────────────────────── shared ────────────────────────────────

/** Does this user hold a given role? `$1` userId, `$2` role name. */
export const userHasRoleQuery = `
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r."id" = ur."roleId" AND r."deletedAt" IS NULL
    WHERE ur."userId" = $1 AND ur."deletedAt" IS NULL AND r."name" = $2
  ) AS "has"
`;

/**
 * The handover auto-penalty window, read straight from config.
 *
 * The same row the penalty cron reads, so the countdown shown on the dashboard is the deadline
 * that will actually be enforced rather than a number copied into two places.
 */
export const handoverPenaltyConfigQuery = `
  SELECT cs."value"
  FROM configurations c
  JOIN config_settings cs ON cs."configId" = c."id" AND cs."isActive" = true
  WHERE c."key" = 'handover_auto_penalty' AND c."deletedAt" IS NULL
  LIMIT 1
`;
