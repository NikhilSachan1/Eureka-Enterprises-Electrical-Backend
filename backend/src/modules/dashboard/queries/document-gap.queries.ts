/**
 * "Kahan atka hai" — the document chain, and where it stops.
 *
 * The chain runs PO → JMC → Invoice → Book Payment → Bank Transfer, and each step also has a file
 * that should have been uploaded against it.
 *
 * A gap is **not** the same thing as a pending approval, and keeping them apart is the whole point
 * of this screen. Something awaiting approval is on somebody's desk and shows up in the approval
 * queues. A gap is something that has *already been approved* and whose next step was never taken
 * — nobody is holding it, no queue contains it, and so today nobody sees it at all.
 *
 * Every gap below was measured against real data before being written, so none of them is a
 * hypothetical.
 */

export interface DocumentGapDef {
  key: string;
  /** The document the gap belongs to; the dashboard lists gaps under it. */
  group: GapGroup;
  label: string;
  /** What the reader should do about it. */
  hint: string;
  /** `problem` needs action; `info` is normal often enough that flagging it would cry wolf. */
  severity: 'problem' | 'info';
  /**
   * The sides this gap can occur on, so the dashboard shows it only under those. Omitted or
   * empty means both. Every row's `partyType` is one of these.
   */
  parties?: GapParty[];
  /**
   * Wording for one side, when the step is named differently there (GSTR-2B vs GSTR-1, 26Q vs
   * 26AS). The contractor and vendor gaps are shown apart, so each reads in its own terms.
   */
  sideText?: Partial<Record<GapParty, GapText>>;
  /**
   * The rows in the gap. `$1` scope (null = company, else raised-by that user), `$2` limit (null =
   * all). Counts are read off this same query, split by `partyType`, so a count can never
   * disagree with the list behind it.
   */
  listSql: string;
}

export type GapParty = 'CONTRACTOR' | 'VENDOR';

/** Document a gap belongs to, in chain order: PO → JMC → site report → invoice → payment. */
export type GapGroup = 'po' | 'jmc' | 'report' | 'payment' | 'advance' | 'gst' | 'tds';

export interface GapText {
  label: string;
  hint: string;
}

export const GAP_PARTIES: GapParty[] = ['CONTRACTOR', 'VENDOR'];

/** Shared by every gap: the row must be live and, when scoped, raised by the reader. */
const scopeOn = (alias: string, col = 'createdBy') =>
  `($1::uuid IS NULL OR ${alias}."${col}" = $1::uuid)`;

/**
 * SALE documents belong to a contractor; PURCHASE documents belong to a vendor.
 * Book payments and advances exist only on the purchase side, so they are always VENDOR.
 */
const partyTypeOf = (alias: string) =>
  `CASE ${alias}."partyType" WHEN 'SALE' THEN 'CONTRACTOR' WHEN 'PURCHASE' THEN 'VENDOR' ELSE NULL END AS "partyType"`;

/**
 * Builds a gap whose count and list read the same rows. `from` is the FROM … WHERE … body and
 * must expose the project as `s`; the other fields are SQL expressions over it.
 */
const defineGap = (g: {
  key: string;
  group: GapGroup;
  label: string;
  hint: string;
  severity: 'problem' | 'info';
  from: string;
  id: string;
  documentNumber: string;
  amount: string;
  since: string;
  partyType: string;
  sideText?: DocumentGapDef['sideText'];
}): DocumentGapDef => ({
  key: g.key,
  group: g.group,
  label: g.label,
  hint: g.hint,
  severity: g.severity,
  sideText: g.sideText,
  // A literal side ('VENDOR') pins the gap to that side; an expression can yield either.
  parties: GAP_PARTIES.filter((p) => g.partyType === `'${p}'`),
  listSql: `
    SELECT ${g.id} AS "id", COALESCE(NULLIF(${g.documentNumber}, ''), '(no number)') AS "documentNumber",
           s."name" AS "siteName", ${g.amount} AS amount, ${g.since} AS "since",
           EXTRACT(DAY FROM NOW() - ${g.since})::int AS "ageDays",
           ${g.partyType} AS "partyType"
    ${g.from}
     ORDER BY ${g.since} ASC NULLS LAST
     LIMIT $2`,
});

/** VENDOR / CONTRACTOR from a register row's SALE / PURCHASE side. */
const sidePartyOf = (alias: string) =>
  `CASE ${alias}."partyType" WHEN 'SALE' THEN 'CONTRACTOR' ELSE 'VENDOR' END`;

/**
 * A GST / TDS register row joined to its live, approved invoice. The register rows are written by
 * the system, so "raised by me" scoping reads the invoice's creator.
 */
const registerFrom = (table: 'gst_register_entries' | 'tds_register_entries', where: string) => `
      FROM ${table} r
      JOIN site_invoices i ON i."id" = r."invoiceId" AND i."deletedAt" IS NULL
                          AND i."approvalStatus" = 'APPROVED'
      LEFT JOIN sites s ON s."id" = r."siteId"
     WHERE r."deletedAt" IS NULL
       AND ${where}
       AND ${scopeOn('i')}`;

/** When the invoice behind a register row was approved — how long the tax step has waited. */
const INVOICE_APPROVED_AT = `COALESCE(i."approvalAt", i."createdAt")`;

/** The advance has gone out: at least one of its bookings has its bank transfer. */
const ADVANCE_PAID = `EXISTS (
  SELECT 1 FROM book_payments b
   WHERE b."advancePaymentId" = a."id" AND b."deletedAt" IS NULL AND b."hasTransfer" = true)`;

/**
 * An approved vendor invoice on the advance's PO that still has room to absorb it: net payable
 * less what is already settled from advances and what is already booked. Expects `a`.
 */
const INVOICE_CAN_ABSORB_ADVANCE = (alias = 'iv') => `
  FROM site_invoices ${alias}
 WHERE ${alias}."poId" = a."poId" AND ${alias}."deletedAt" IS NULL
   AND ${alias}."approvalStatus" = 'APPROVED' AND ${alias}."partyType" = 'PURCHASE'
   AND ${INVOICE_PENDING_TO_BOOK(alias)} > 0.01`;

/**
 * What the invoice payment covers: taxable − TDS when GST is held (the held GST is settled on its
 * own), taxable + GST − TDS otherwise.
 */
const INVOICE_NET_PAYABLE = (alias: string) => `(CASE WHEN ${alias}."isGstHold" = true
    THEN COALESCE(${alias}."taxableAmount", 0) - COALESCE(${alias}."tdsAmount", 0)
    ELSE COALESCE(${alias}."taxableAmount", 0) + COALESCE(${alias}."gstAmount", 0) - COALESCE(${alias}."tdsAmount", 0)
  END)`;

/** Vendor invoice amount not booked yet: net payable less advances settled and bookings made. */
const INVOICE_PENDING_TO_BOOK = (alias: string) =>
  `(${INVOICE_NET_PAYABLE(
    alias,
  )} - COALESCE(${alias}."advanceSettledAmount", 0) - COALESCE(${alias}."bookedTotal", 0))`;

/** Invoice amount not paid / received yet: net payable less advances settled and paid. */
const INVOICE_STILL_TO_PAY = (alias: string) =>
  `(${INVOICE_NET_PAYABLE(
    alias,
  )} - COALESCE(${alias}."advanceSettledAmount", 0) - COALESCE(${alias}."paidTotal", 0))`;

/** A live, approved, real (numbered) vendor invoice. */
const VENDOR_INVOICE_LIVE = (alias: string) =>
  `${alias}."deletedAt" IS NULL AND ${alias}."approvalStatus" = 'APPROVED'
       AND ${alias}."partyType" = 'PURCHASE' AND ${alias}."invoiceNumber" IS NOT NULL`;

/** A live, approved, real (numbered) contractor invoice. */
const CONTRACTOR_INVOICE_LIVE = (alias: string) =>
  `${alias}."deletedAt" IS NULL AND ${alias}."approvalStatus" = 'APPROVED'
       AND ${alias}."partyType" = 'SALE' AND ${alias}."invoiceNumber" IS NOT NULL`;

/** Live, approved advances with a balance not yet settled against an invoice. Expects `a`. */
const ADVANCE_OPEN = `a."deletedAt" IS NULL AND a."approvalStatus" = 'APPROVED'
         AND COALESCE(a."settledAmount", 0) < a."amount"`;

export const DOCUMENT_GAPS: DocumentGapDef[] = [
  {
    key: 'po-without-jmc',
    group: 'po',
    label: 'PO approved, no JMC raised',
    hint: 'Raise the JMC, or mark it as a No-JMC purchase order.',
    severity: 'problem',
    listSql: `
      SELECT po."id", COALESCE(NULLIF(po."poNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             po."totalAmount" AS amount, po."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - po."approvalAt")::int AS "ageDays",
             ${partyTypeOf('po')}
        FROM purchase_orders po
        LEFT JOIN sites s ON s."id" = po."siteId"
       WHERE po."deletedAt" IS NULL AND po."approvalStatus" = 'APPROVED'
         AND ${scopeOn('po')}
         AND NOT EXISTS (
           SELECT 1 FROM jmcs j WHERE j."poId" = po."id" AND j."deletedAt" IS NULL
         )
       ORDER BY po."approvalAt" ASC NULLS LAST
       LIMIT $2`,
  },
  // A vendor JMC needs its site report before the invoice can be raised, so for those the report
  // is the step that is stuck — counted below, not here.
  defineGap({
    key: 'jmc-without-invoice',
    group: 'jmc',
    label: 'JMC approved, no invoice raised',
    hint: 'Raise the invoice against this JMC.',
    severity: 'problem',
    from: `
      FROM jmcs j
      LEFT JOIN sites s ON s."id" = j."siteId"
     WHERE j."deletedAt" IS NULL AND j."approvalStatus" = 'APPROVED'
       AND ${scopeOn('j')}
       AND NOT EXISTS (
         SELECT 1 FROM site_invoices i WHERE i."jmcId" = j."id" AND i."deletedAt" IS NULL)
       AND (j."partyType" = 'SALE' OR EXISTS (
         SELECT 1 FROM site_reports r WHERE r."jmcId" = j."id" AND r."deletedAt" IS NULL))`,
    id: 'j."id"',
    documentNumber: 'j."jmcNumber"',
    amount: 'NULL::numeric',
    since: 'COALESCE(j."approvalAt", j."createdAt")',
    partyType: sidePartyOf('j'),
  }),
  defineGap({
    key: 'jmc-without-report',
    group: 'report',
    label: 'JMC approved, site report not added',
    hint: 'Add the site report, or mark it as no report.',
    sideText: {
      VENDOR: {
        label: 'JMC approved, site report not added',
        hint: 'Add the site report (or mark it as no report) so the invoice can be raised.',
      },
    },
    severity: 'problem',
    // Vendor: the report is needed before the invoice, so a JMC already invoiced is past this
    // step. Contractor: the report does not block the invoice, so it stays owed until added.
    from: `
      FROM jmcs j
      LEFT JOIN sites s ON s."id" = j."siteId"
     WHERE j."deletedAt" IS NULL AND j."approvalStatus" = 'APPROVED'
       AND COALESCE(j."isNoJmc", false) = false
       AND ${scopeOn('j')}
       AND NOT EXISTS (
         SELECT 1 FROM site_reports r WHERE r."jmcId" = j."id" AND r."deletedAt" IS NULL)
       AND (j."partyType" = 'SALE' OR NOT EXISTS (
         SELECT 1 FROM site_invoices i WHERE i."jmcId" = j."id" AND i."deletedAt" IS NULL))`,
    id: 'j."id"',
    documentNumber: 'j."jmcNumber"',
    amount: 'NULL::numeric',
    since: 'COALESCE(j."approvalAt", j."createdAt")',
    partyType: sidePartyOf('j'),
  }),

  // Vendor invoices only (a contractor invoice is never booked — it is received, see below), real
  // invoices only (a "No invoice / bill later" marker has no number), and only while something is
  // still to book: net payable less advances settled against it less bookings already made.
  defineGap({
    key: 'invoice-not-booked',
    group: 'payment',
    label: 'Invoice approved, not booked for payment',
    hint: 'Create the book payment so it can be paid.',
    severity: 'problem',
    from: `
      FROM site_invoices i
      LEFT JOIN sites s ON s."id" = i."siteId"
     WHERE ${VENDOR_INVOICE_LIVE('i')}
       AND ${INVOICE_PENDING_TO_BOOK('i')} > 0.01
       AND NOT EXISTS (
         SELECT 1 FROM book_payments b
          WHERE b."invoiceId" = i."id" AND b."deletedAt" IS NULL AND b."sourceType" = 'INVOICE')
       AND ${scopeOn('i')}`,
    id: 'i."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: INVOICE_PENDING_TO_BOOK('i'),
    since: 'COALESCE(i."approvalAt", i."createdAt")',
    partyType: `'VENDOR'`,
  }),
  defineGap({
    key: 'invoice-partially-booked',
    group: 'payment',
    label: 'Invoice partly booked, balance not booked',
    hint: 'Book the remaining amount of the invoice.',
    severity: 'problem',
    from: `
      FROM site_invoices i
      LEFT JOIN sites s ON s."id" = i."siteId"
     WHERE ${VENDOR_INVOICE_LIVE('i')}
       AND ${INVOICE_PENDING_TO_BOOK('i')} > 0.01
       AND EXISTS (
         SELECT 1 FROM book_payments b
          WHERE b."invoiceId" = i."id" AND b."deletedAt" IS NULL AND b."sourceType" = 'INVOICE')
       AND ${scopeOn('i')}`,
    id: 'i."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: INVOICE_PENDING_TO_BOOK('i'),
    since: 'COALESCE(i."approvalAt", i."createdAt")',
    partyType: `'VENDOR'`,
  }),
  // The contractor side has no booking step — the client pays straight in — so where a vendor
  // invoice is "not booked / partly booked", a contractor invoice is "not received / partly
  // received".
  defineGap({
    key: 'contractor-payment-pending',
    group: 'payment',
    label: 'Invoice approved, payment not received',
    hint: 'Follow up with the client, then record the bank transfer.',
    severity: 'problem',
    from: `
      FROM site_invoices i
      LEFT JOIN sites s ON s."id" = i."siteId"
     WHERE ${CONTRACTOR_INVOICE_LIVE('i')}
       AND ${INVOICE_STILL_TO_PAY('i')} > 0.01
       AND COALESCE(i."paidTotal", 0) <= 0.01
       AND ${scopeOn('i')}`,
    id: 'i."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: INVOICE_STILL_TO_PAY('i'),
    since: 'COALESCE(i."approvalAt", i."createdAt")',
    partyType: `'CONTRACTOR'`,
  }),
  defineGap({
    key: 'contractor-payment-partial',
    group: 'payment',
    label: 'Invoice partly received, balance not received',
    hint: 'Follow up with the client for the balance, then record the bank transfer.',
    severity: 'problem',
    from: `
      FROM site_invoices i
      LEFT JOIN sites s ON s."id" = i."siteId"
     WHERE ${CONTRACTOR_INVOICE_LIVE('i')}
       AND ${INVOICE_STILL_TO_PAY('i')} > 0.01
       AND COALESCE(i."paidTotal", 0) > 0.01
       AND ${scopeOn('i')}`,
    id: 'i."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: INVOICE_STILL_TO_PAY('i'),
    since: 'COALESCE(i."approvalAt", i."createdAt")',
    partyType: `'CONTRACTOR'`,
  }),
  // Invoice bookings only — an advance's booking and a GST release each have a gap of their own
  // below, worded for what they are, so counting them here as well would show them twice.
  {
    key: 'booked-not-transferred',
    group: 'payment',
    label: 'Book payment approved, money not transferred',
    hint: 'Record the bank transfer, or put it on a payment sheet.',
    severity: 'problem',
    parties: ['VENDOR'],
    listSql: `
      SELECT b."id", COALESCE(NULLIF(i."invoiceNumber", ''), '(no number)') AS "documentNumber",
             s."name" AS "siteName", b."paymentTotalAmount" AS amount,
             b."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - b."approvalAt")::int AS "ageDays",
             'VENDOR' AS "partyType"
        FROM book_payments b
        LEFT JOIN sites s ON s."id" = b."siteId"
        LEFT JOIN site_invoices i ON i."id" = b."invoiceId"
       WHERE b."deletedAt" IS NULL AND b."approvalStatus" = 'APPROVED'
         AND b."hasTransfer" = false
         AND b."sourceType" = 'INVOICE'
         AND ${scopeOn('b')}
       ORDER BY b."approvalAt" ASC NULLS LAST
       LIMIT $2`,
  },

  // ── advances ──
  //
  // An advance runs: approved (its booking is created on approval) → paid by bank transfer →
  // settled against the vendor's invoice once it is raised. Each step that has stalled is its own
  // gap, because each one needs a different person to act.
  defineGap({
    key: 'advance-not-paid',
    group: 'advance',
    label: 'Advance approved, money not transferred',
    hint: 'Pay the advance from a payment sheet or record its bank transfer.',
    severity: 'problem',
    from: `
      FROM book_payments b
      JOIN advance_payments a ON a."id" = b."advancePaymentId" AND a."deletedAt" IS NULL
      LEFT JOIN sites s ON s."id" = b."siteId"
     WHERE b."deletedAt" IS NULL AND b."approvalStatus" = 'APPROVED'
       AND b."sourceType" = 'ADVANCE' AND b."hasTransfer" = false
       AND ${scopeOn('a')}`,
    id: 'a."id"',
    documentNumber: 'a."advanceNumber"',
    amount: 'b."paymentTotalAmount"',
    since: 'COALESCE(b."approvalAt", b."createdAt")',
    partyType: `'VENDOR'`,
  }),
  defineGap({
    key: 'advance-invoice-not-adjusted',
    group: 'advance',
    label: 'Advance paid, invoice raised but advance not adjusted',
    hint: 'Settle the advance against the vendor invoice on the same PO.',
    severity: 'problem',
    from: `
      FROM advance_payments a
      LEFT JOIN sites s ON s."id" = a."siteId"
     WHERE ${ADVANCE_OPEN}
       AND ${ADVANCE_PAID}
       AND EXISTS (SELECT 1 ${INVOICE_CAN_ABSORB_ADVANCE()})
       AND ${scopeOn('a')}`,
    id: 'a."id"',
    documentNumber: `a."advanceNumber" || COALESCE(' → ' || (
        SELECT iv."invoiceNumber" ${INVOICE_CAN_ABSORB_ADVANCE()}
         ORDER BY iv."invoiceDate" ASC NULLS LAST LIMIT 1), '')`,
    amount: '(a."amount" - COALESCE(a."settledAmount", 0))',
    since: 'a."advanceDate"',
    partyType: `'VENDOR'`,
  }),

  // ── GST ──
  //
  // Every entry is matched on the portal (GSTR-2B for vendor invoices, GSTR-1 for ours). Held GST
  // is then settled: released to the vendor through a GST book payment and its bank transfer, or
  // received from the client as a GST bank transfer.
  defineGap({
    key: 'gst-not-verified',
    group: 'gst',
    label: 'GST not verified on the portal',
    hint: 'Check GSTR-2B (vendor) / GSTR-1 (contractor) and verify the entry in the GST summary.',
    sideText: {
      VENDOR: {
        label: 'GST not verified in GSTR-2B',
        hint: 'Check the vendor’s invoice in GSTR-2B, then verify it in the GST summary.',
      },
      CONTRACTOR: {
        label: 'GST not verified in GSTR-1',
        hint: 'Check the invoice in our GSTR-1, then verify it in the GST summary.',
      },
    },
    severity: 'problem',
    from: registerFrom('gst_register_entries', `r."isVerified" = false`),
    id: 'r."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: 'r."gstAmount"',
    since: INVOICE_APPROVED_AT,
    partyType: sidePartyOf('r'),
  }),
  defineGap({
    key: 'gst-release-pending',
    group: 'gst',
    label: 'Held GST verified, release not booked',
    hint: 'Book the GST release from the GST summary.',
    severity: 'problem',
    from: registerFrom(
      'gst_register_entries',
      `r."partyType" = 'PURCHASE' AND r."isGstHold" = true AND r."isVerified" = true
       AND r."gstPaymentId" IS NULL AND r."gstBookPaymentId" IS NULL AND r."gstBankTransferId" IS NULL`,
    ),
    id: 'r."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: 'r."gstAmount"',
    since: 'COALESCE(r."verifiedAt", i."approvalAt", i."createdAt")',
    partyType: `'VENDOR'`,
  }),
  defineGap({
    key: 'gst-release-not-transferred',
    group: 'gst',
    label: 'GST release booked, money not transferred',
    hint: 'Pay the GST release from a payment sheet or record its bank transfer.',
    severity: 'problem',
    from: `
      FROM gst_register_entries r
      JOIN site_invoices i ON i."id" = r."invoiceId" AND i."deletedAt" IS NULL
      JOIN book_payments b ON b."id" = r."gstBookPaymentId" AND b."deletedAt" IS NULL
      LEFT JOIN sites s ON s."id" = r."siteId"
     WHERE r."deletedAt" IS NULL
       AND r."gstBankTransferId" IS NULL AND r."gstPaymentId" IS NULL
       AND ${scopeOn('i')}`,
    id: 'r."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: 'b."paymentTotalAmount"',
    since: 'COALESCE(b."approvalAt", b."createdAt")',
    partyType: `'VENDOR'`,
  }),
  defineGap({
    key: 'gst-receipt-pending',
    group: 'gst',
    label: 'Held GST not yet received from the client',
    hint: 'Once the client pays the withheld GST, mark it received in the GST summary.',
    severity: 'problem',
    from: registerFrom(
      'gst_register_entries',
      `r."partyType" = 'SALE' AND r."isGstHold" = true
       AND r."gstPaymentId" IS NULL AND r."gstBankTransferId" IS NULL`,
    ),
    id: 'r."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: 'r."gstAmount"',
    since: INVOICE_APPROVED_AT,
    partyType: `'CONTRACTOR'`,
  }),

  // ── TDS ──
  //
  // Vendor side: we deduct, deposit it by challan, then it shows in our 26Q. Contractor side: the
  // client deducts and deposits, and we check the credit in Form 26AS.
  defineGap({
    key: 'tds-challan-pending',
    group: 'tds',
    label: 'TDS deducted, challan not recorded',
    hint: 'Deposit the TDS and record the challan in the TDS summary.',
    severity: 'problem',
    from: registerFrom(
      'tds_register_entries',
      `r."partyType" = 'PURCHASE' AND r."tdsPaymentId" IS NULL AND r."tdsAmount" > 0`,
    ),
    id: 'r."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: 'r."tdsAmount"',
    since: INVOICE_APPROVED_AT,
    partyType: `'VENDOR'`,
  }),
  defineGap({
    key: 'tds-not-verified',
    group: 'tds',
    label: 'TDS not verified in 26Q / Form 26AS',
    hint: 'Vendor: verify once filed in 26Q. Contractor: verify the credit in Form 26AS.',
    sideText: {
      VENDOR: {
        label: 'TDS deposited, not verified in 26Q',
        hint: 'Verify the entry in the TDS summary once it is filed in the 26Q return.',
      },
      CONTRACTOR: {
        label: 'TDS not verified in Form 26AS',
        hint: 'Check the client’s TDS credit in Form 26AS, then verify it in the TDS summary.',
      },
    },
    severity: 'problem',
    from: registerFrom(
      'tds_register_entries',
      `r."isVerified" = false AND r."tdsAmount" > 0
       AND (r."partyType" = 'SALE' OR r."tdsPaymentId" IS NOT NULL)`,
    ),
    id: 'r."id"',
    documentNumber: 'i."invoiceNumber"',
    amount: 'r."tdsAmount"',
    since: INVOICE_APPROVED_AT,
    partyType: sidePartyOf('r'),
  }),

  // ── missing files ──
  //
  // A No-JMC entry stands for the absence of a JMC, so there is no certificate behind it. An
  // uploaded JMC carries its file from the start, so in practice this lists generated JMCs whose
  // signed copy has not come back yet — and a JMC cannot be approved until it does.
  {
    key: 'jmc-file-missing',
    group: 'jmc',
    label: 'JMC generated, signed copy not uploaded',
    hint: 'Get the generated JMC signed and upload it — it cannot be approved without the signed copy.',
    severity: 'problem',
    listSql: `
      SELECT j."id", COALESCE(NULLIF(j."jmcNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             NULL::numeric AS amount, j."createdAt" AS "since",
             EXTRACT(DAY FROM NOW() - j."createdAt")::int AS "ageDays",
             ${partyTypeOf('j')}
        FROM jmcs j
        LEFT JOIN sites s ON s."id" = j."siteId"
       WHERE j."deletedAt" IS NULL
         AND COALESCE(j."isNoJmc", false) = false
         AND (j."fileKey" IS NULL OR j."fileKey" = '')
         AND ${scopeOn('j')}
       ORDER BY j."createdAt" ASC
       LIMIT $2`,
  },
  defineGap({
    key: 'advance-file-missing',
    group: 'advance',
    label: 'Advance with no document uploaded',
    hint: 'Upload the vendor’s advance request / proforma.',
    severity: 'problem',
    from: `
      FROM advance_payments a
      LEFT JOIN sites s ON s."id" = a."siteId"
     WHERE a."deletedAt" IS NULL AND a."approvalStatus" <> 'REJECTED'
       AND (a."fileKey" IS NULL OR a."fileKey" = '')
       AND ${scopeOn('a')}`,
    id: 'a."id"',
    documentNumber: 'a."advanceNumber"',
    amount: 'a."amount"',
    since: 'a."createdAt"',
    partyType: `'VENDOR'`,
  }),

  // ── reported, not flagged ──
  //
  // An advance exists because work starts before the bill. Until the vendor raises an invoice
  // there is nothing to settle it against, so a paid advance waiting for its invoice is normal —
  // it is listed, not flagged. Once an invoice it can be settled against exists, it moves to the
  // "invoice raised but advance not adjusted" problem above.
  defineGap({
    key: 'advance-not-settled',
    group: 'advance',
    label: 'Advance paid, invoice awaited',
    hint: 'Settle the advance once the vendor raises the invoice.',
    severity: 'info',
    from: `
      FROM advance_payments a
      LEFT JOIN sites s ON s."id" = a."siteId"
     WHERE ${ADVANCE_OPEN}
       AND ${ADVANCE_PAID}
       AND NOT EXISTS (SELECT 1 ${INVOICE_CAN_ABSORB_ADVANCE()})
       AND ${scopeOn('a')}`,
    id: 'a."id"',
    documentNumber: 'a."advanceNumber"',
    amount: '(a."amount" - COALESCE(a."settledAmount", 0))',
    since: 'a."advanceDate"',
    partyType: `'VENDOR'`,
  }),

  // ── reported, not flagged ──
  //
  // Part-billing against a PO is ordinary practice, so this is never a red mark. It is here
  // because "what have we not billed yet" is a real question, and burying it among the problems
  // would train people to ignore the list.
  {
    key: 'po-under-invoiced',
    group: 'po',
    label: 'PO not fully invoiced',
    hint: 'Normal while work is in progress — shown so nothing is forgotten.',
    severity: 'info',
    listSql: `
      SELECT po."id", COALESCE(NULLIF(po."poNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             (po."totalAmount" - COALESCE(po."invoicedTotal", 0)) AS amount,
             po."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - po."approvalAt")::int AS "ageDays",
             ${partyTypeOf('po')}
        FROM purchase_orders po
        LEFT JOIN sites s ON s."id" = po."siteId"
       WHERE po."deletedAt" IS NULL AND po."approvalStatus" = 'APPROVED'
         AND COALESCE(po."invoicedTotal", 0) < po."totalAmount"
         AND ${scopeOn('po')}
       ORDER BY po."approvalAt" ASC NULLS LAST
       LIMIT $2`,
  },
];

export const findGap = (key: string) => DOCUMENT_GAPS.find((g) => g.key === key);

/** The gap's label and hint as one side reads them. */
export const gapTextFor = (gap: DocumentGapDef, party: GapParty): GapText =>
  gap.sideText?.[party] ?? { label: gap.label, hint: gap.hint };

/** The sides a gap is shown under. */
export const gapParties = (gap: DocumentGapDef): GapParty[] =>
  gap.parties?.length ? gap.parties : GAP_PARTIES;

/** A row with no side (a document missing its `partyType`) is a vendor one, as the screens treat it. */
const ROW_PARTY = `COALESCE(x."partyType", 'VENDOR')`;

/** A gap's rows counted per side. `$1` scope, `$2` must be null (no limit). */
export const gapCountsSql = (gap: DocumentGapDef) => `
  SELECT ${ROW_PARTY} AS "partyType", COUNT(*)::int AS count,
         COALESCE(MAX(x."ageDays"), 0)::int AS "oldestDays"
    FROM (${gap.listSql}) x
   GROUP BY 1`;

/** A gap's rows on one side. `$1` scope, `$2` null, `$3` side (null = both), `$4` limit. */
export const gapListSql = (gap: DocumentGapDef) => `
  SELECT x.*
    FROM (${gap.listSql}) x
   WHERE $3::text IS NULL OR ${ROW_PARTY} = $3::text
   ORDER BY x."since" ASC NULLS LAST
   LIMIT $4`;
