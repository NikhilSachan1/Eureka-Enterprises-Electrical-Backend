/**
 * "Kiska kya baaki hai" — every approval queue in the system, counted in one pass.
 *
 * The queues are declared once, below, rather than written out as ten near-identical queries. Each
 * one names the table it counts, the value its pending state is spelled with (the financial
 * documents use upper case and the HR ones lower case), the column that says who raised it, and
 * the permission that decides who may approve it.
 *
 * The permission is the important part: who can approve what is already in `role_permissions`, so
 * this reads that mapping rather than restating it. Change a role's permissions and the dashboard
 * follows with no code change — and it cannot quietly disagree with what the API will actually
 * allow.
 */

export interface ApprovalQueueDef {
  key: string;
  label: string;
  table: string;
  /** How this table spells "waiting for approval". */
  pendingValue: string;
  /** Column naming the person who raised the row. */
  raisedByColumn: string;
  /** The permission that lets a role clear this queue; null when nothing guards it. */
  permission: string | null;
  /** Extra conditions this table needs for a row to count as live. */
  liveCondition?: string;
}

export const APPROVAL_QUEUES: ApprovalQueueDef[] = [
  {
    key: 'purchase-orders',
    label: 'Purchase Orders',
    table: 'purchase_orders',
    pendingValue: 'PENDING',
    raisedByColumn: 'createdBy',
    permission: 'financials.purchase-orders.approve',
  },
  {
    key: 'jmcs',
    label: 'JMCs',
    table: 'jmcs',
    pendingValue: 'PENDING',
    raisedByColumn: 'createdBy',
    permission: 'financials.jmcs.approve',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    table: 'site_invoices',
    pendingValue: 'PENDING',
    raisedByColumn: 'createdBy',
    permission: 'financials.invoices.approve',
  },
  {
    key: 'book-payments',
    label: 'Book Payments',
    table: 'book_payments',
    pendingValue: 'PENDING',
    raisedByColumn: 'createdBy',
    permission: 'financials.book-payments.approve',
  },
  {
    key: 'advance-payments',
    label: 'Advance Payments',
    table: 'advance_payments',
    pendingValue: 'PENDING',
    raisedByColumn: 'createdBy',
    permission: 'financials.advance-payments.approve',
  },
  {
    key: 'site-reports',
    label: 'Site Reports',
    table: 'site_reports',
    pendingValue: 'PENDING',
    raisedByColumn: 'createdBy',
    permission: 'financials.site-reports.approve',
  },
  {
    key: 'leave',
    label: 'Leave Applications',
    table: 'leave_applications',
    pendingValue: 'pending',
    raisedByColumn: 'userId',
    permission: 'leave.approve',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    table: 'attendances',
    pendingValue: 'pending',
    raisedByColumn: 'userId',
    permission: 'attendance.approve',
    liveCondition: '"isActive" = true',
  },
  {
    key: 'expense',
    label: 'Expenses',
    table: 'expenses',
    pendingValue: 'pending',
    raisedByColumn: 'userId',
    permission: 'expense.approve',
    liveCondition: '"isActive" = true',
  },
  {
    key: 'fuel',
    label: 'Fuel Expenses',
    table: 'fuel_expenses',
    pendingValue: 'pending',
    raisedByColumn: 'userId',
    permission: 'fuel.approve',
    liveCondition: '"isActive" = true',
  },
];

/**
 * Every queue's totals in one round trip.
 *
 * `$1` the scope — null counts the company, a user id counts only what that person raised.
 * `$2` the reader, always set, used for "what I raised that is still waiting" regardless of scope.
 *
 * `oldestDays` is the age of the longest-waiting row in the queue, which is what turns a count
 * into something worth acting on: eight pending POs matter differently when the oldest is two
 * weeks old.
 */
export const approvalQueueCountsQuery = APPROVAL_QUEUES.map((q) => {
  const live = ['"deletedAt" IS NULL', q.liveCondition].filter(Boolean).join(' AND ');
  const pending = `"approvalStatus" = '${q.pendingValue}'`;
  const inScope = `($1::uuid IS NULL OR "${q.raisedByColumn}" = $1::uuid)`;
  return `
  SELECT
    '${q.key}'::text AS key,
    COUNT(*) FILTER (WHERE ${inScope})::int AS total,
    COUNT(*) FILTER (WHERE ${pending} AND ${inScope})::int AS pending,
    COUNT(*) FILTER (WHERE ${pending} AND "${q.raisedByColumn}" = $2::uuid)::int AS "raisedByMe",
    COALESCE(
      MAX(EXTRACT(DAY FROM NOW() - "createdAt")) FILTER (WHERE ${pending} AND ${inScope}), 0
    )::int AS "oldestDays"
  FROM ${q.table}
  WHERE ${live}`;
}).join('\n  UNION ALL\n');

/**
 * Which of these queues the reader's roles can actually clear.
 *
 * Read from `role_permissions` rather than hard-coded, for the reason given at the top of the
 * file. `$1` is the reader.
 */
export const myApprovalPermissionsQuery = `
  SELECT DISTINCT p."name"
    FROM user_roles ur
    JOIN role_permissions rp ON rp."roleId" = ur."roleId" AND rp."deletedAt" IS NULL
    JOIN permissions p ON p."id" = rp."permissionId" AND p."deletedAt" IS NULL
   WHERE ur."userId" = $1
     AND ur."deletedAt" IS NULL
     AND p."name" LIKE '%.approve'
`;

/**
 * Payment sheets waiting at each stage of the chain.
 *
 * A payment sheet is not approved once — it walks a configured chain, and at any moment it is
 * sitting on exactly one stage's desk. This is what "OM ne process kar di, ab HR ko dikhe" means:
 * the sheet's `currentStage` is the answer, and the stage's role in the configured flow is whose
 * desk that is.
 *
 * Terminal sheets are excluded — a completed or rejected sheet is on nobody's desk. A DRAFT or
 * RETURNED one is counted at its stage on purpose: it is genuinely waiting on the initiator, and
 * leaving it out would let work disappear from the board by being sent back.
 *
 * `$1` the scope — null counts every sheet, a user id counts only the ones that person raised.
 */
export const paymentSheetStageCountsQuery = `
  SELECT
    ps."currentStage" AS stage,
    ps."status"       AS status,
    COUNT(*)::int     AS count,
    COALESCE(MAX(EXTRACT(DAY FROM NOW() - ps."updatedAt")), 0)::int AS "oldestDays"
  FROM payment_sheets ps
  WHERE ps."deletedAt" IS NULL
    AND ps."currentStage" IS NOT NULL
    AND ps."status" NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')
    AND ($1::uuid IS NULL OR ps."createdBy" = $1::uuid)
  GROUP BY ps."currentStage", ps."status"
`;

/** The configured payment-sheet chain, so stages can be named with the desk they sit on. */
export const paymentSheetFlowQuery = `
  SELECT cs."value" AS value
    FROM config_settings cs
    JOIN configurations c ON c."id" = cs."configId"
   WHERE c."key" = 'payments.approval_flow'
     AND cs."isActive" = true
     AND cs."deletedAt" IS NULL
   ORDER BY cs."createdAt" DESC
   LIMIT 1
`;
