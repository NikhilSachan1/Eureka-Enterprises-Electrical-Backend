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
  label: string;
  /** What the reader should do about it. */
  hint: string;
  /** `problem` needs action; `info` is normal often enough that flagging it would cry wolf. */
  severity: 'problem' | 'info';
  /** Counts the rows in the gap. `$1` = scope (null = company, else raised-by that user). */
  countSql: string;
  /** The same rows, listed. `$1` scope, `$2` limit. */
  listSql: string;
}

/** Shared by every gap: the row must be live and, when scoped, raised by the reader. */
const scopeOn = (alias: string, col = 'createdBy') =>
  `($1::uuid IS NULL OR ${alias}."${col}" = $1::uuid)`;

export const DOCUMENT_GAPS: DocumentGapDef[] = [
  {
    key: 'po-without-jmc',
    label: 'PO approved, no JMC raised',
    hint: 'Raise the JMC, or mark it as a No-JMC purchase order.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - po."approvalAt")), 0)::int AS "oldestDays"
        FROM purchase_orders po
       WHERE po."deletedAt" IS NULL AND po."approvalStatus" = 'APPROVED'
         AND ${scopeOn('po')}
         AND NOT EXISTS (
           SELECT 1 FROM jmcs j WHERE j."poId" = po."id" AND j."deletedAt" IS NULL
         )`,
    listSql: `
      SELECT po."id", COALESCE(NULLIF(po."poNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             po."totalAmount" AS amount, po."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - po."approvalAt")::int AS "ageDays"
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
  {
    key: 'jmc-without-invoice',
    label: 'JMC approved, no invoice raised',
    hint: 'Raise the invoice against this JMC.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - j."approvalAt")), 0)::int AS "oldestDays"
        FROM jmcs j
       WHERE j."deletedAt" IS NULL AND j."approvalStatus" = 'APPROVED'
         AND ${scopeOn('j')}
         AND NOT EXISTS (
           SELECT 1 FROM site_invoices i WHERE i."jmcId" = j."id" AND i."deletedAt" IS NULL
         )`,
    listSql: `
      SELECT j."id", COALESCE(NULLIF(j."jmcNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             NULL::numeric AS amount, j."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - j."approvalAt")::int AS "ageDays"
        FROM jmcs j
        LEFT JOIN sites s ON s."id" = j."siteId"
       WHERE j."deletedAt" IS NULL AND j."approvalStatus" = 'APPROVED'
         AND ${scopeOn('j')}
         AND NOT EXISTS (
           SELECT 1 FROM site_invoices i WHERE i."jmcId" = j."id" AND i."deletedAt" IS NULL
         )
       ORDER BY j."approvalAt" ASC NULLS LAST
       LIMIT $2`,
  },
  {
    key: 'invoice-not-booked',
    label: 'Invoice approved, not booked for payment',
    hint: 'Create the book payment so it can be paid.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - i."approvalAt")), 0)::int AS "oldestDays"
        FROM site_invoices i
       WHERE i."deletedAt" IS NULL AND i."approvalStatus" = 'APPROVED'
         AND ${scopeOn('i')}
         AND NOT EXISTS (
           SELECT 1 FROM book_payments b WHERE b."invoiceId" = i."id" AND b."deletedAt" IS NULL
         )`,
    listSql: `
      SELECT i."id", COALESCE(NULLIF(i."invoiceNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             i."totalAmount" AS amount, i."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - i."approvalAt")::int AS "ageDays"
        FROM site_invoices i
        LEFT JOIN sites s ON s."id" = i."siteId"
       WHERE i."deletedAt" IS NULL AND i."approvalStatus" = 'APPROVED'
         AND ${scopeOn('i')}
         AND NOT EXISTS (
           SELECT 1 FROM book_payments b WHERE b."invoiceId" = i."id" AND b."deletedAt" IS NULL
         )
       ORDER BY i."approvalAt" ASC NULLS LAST
       LIMIT $2`,
  },
  {
    key: 'booked-not-transferred',
    label: 'Book payment approved, money not transferred',
    hint: 'Record the bank transfer, or put it on a payment sheet.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - b."approvalAt")), 0)::int AS "oldestDays"
        FROM book_payments b
       WHERE b."deletedAt" IS NULL AND b."approvalStatus" = 'APPROVED'
         AND b."hasTransfer" = false
         AND ${scopeOn('b')}`,
    listSql: `
      SELECT b."id", COALESCE(NULLIF(i."invoiceNumber", ''), '(no number)') AS "documentNumber",
             s."name" AS "siteName", b."paymentTotalAmount" AS amount,
             b."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - b."approvalAt")::int AS "ageDays"
        FROM book_payments b
        LEFT JOIN sites s ON s."id" = b."siteId"
        LEFT JOIN site_invoices i ON i."id" = b."invoiceId"
       WHERE b."deletedAt" IS NULL AND b."approvalStatus" = 'APPROVED'
         AND b."hasTransfer" = false
         AND ${scopeOn('b')}
       ORDER BY b."approvalAt" ASC NULLS LAST
       LIMIT $2`,
  },
  {
    key: 'advance-not-settled',
    label: 'Advance paid, not fully settled',
    hint: 'Settle the advance against an invoice.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - a."advanceDate")), 0)::int AS "oldestDays"
        FROM advance_payments a
       WHERE a."deletedAt" IS NULL AND a."approvalStatus" = 'APPROVED'
         AND COALESCE(a."settledAmount", 0) < a."amount"
         AND ${scopeOn('a')}`,
    listSql: `
      SELECT a."id", COALESCE(NULLIF(a."advanceNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             (a."amount" - COALESCE(a."settledAmount", 0)) AS amount,
             a."advanceDate" AS "since",
             EXTRACT(DAY FROM NOW() - a."advanceDate")::int AS "ageDays"
        FROM advance_payments a
        LEFT JOIN sites s ON s."id" = a."siteId"
       WHERE a."deletedAt" IS NULL AND a."approvalStatus" = 'APPROVED'
         AND COALESCE(a."settledAmount", 0) < a."amount"
         AND ${scopeOn('a')}
       ORDER BY a."advanceDate" ASC NULLS LAST
       LIMIT $2`,
  },

  // ── missing files ──
  //
  // A system-generated document has no file to upload and never will, so counting it would make
  // the list permanently wrong. A No-JMC entry is the same: it stands for the absence of a JMC,
  // so there is no certificate behind it.
  {
    key: 'po-file-missing',
    label: 'PO with no document uploaded',
    hint: 'Upload the signed purchase order.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - po."createdAt")), 0)::int AS "oldestDays"
        FROM purchase_orders po
       WHERE po."deletedAt" IS NULL
         AND COALESCE(po."isSystemGenerated", false) = false
         AND (po."fileKey" IS NULL OR po."fileKey" = '')
         AND ${scopeOn('po')}`,
    listSql: `
      SELECT po."id", COALESCE(NULLIF(po."poNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             po."totalAmount" AS amount, po."createdAt" AS "since",
             EXTRACT(DAY FROM NOW() - po."createdAt")::int AS "ageDays"
        FROM purchase_orders po
        LEFT JOIN sites s ON s."id" = po."siteId"
       WHERE po."deletedAt" IS NULL
         AND COALESCE(po."isSystemGenerated", false) = false
         AND (po."fileKey" IS NULL OR po."fileKey" = '')
         AND ${scopeOn('po')}
       ORDER BY po."createdAt" ASC
       LIMIT $2`,
  },
  {
    key: 'jmc-file-missing',
    label: 'JMC with no document uploaded',
    hint: 'Upload the signed JMC.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - j."createdAt")), 0)::int AS "oldestDays"
        FROM jmcs j
       WHERE j."deletedAt" IS NULL
         AND COALESCE(j."isNoJmc", false) = false
         AND COALESCE(j."isSystemGenerated", false) = false
         AND (j."fileKey" IS NULL OR j."fileKey" = '')
         AND ${scopeOn('j')}`,
    listSql: `
      SELECT j."id", COALESCE(NULLIF(j."jmcNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             NULL::numeric AS amount, j."createdAt" AS "since",
             EXTRACT(DAY FROM NOW() - j."createdAt")::int AS "ageDays"
        FROM jmcs j
        LEFT JOIN sites s ON s."id" = j."siteId"
       WHERE j."deletedAt" IS NULL
         AND COALESCE(j."isNoJmc", false) = false
         AND COALESCE(j."isSystemGenerated", false) = false
         AND (j."fileKey" IS NULL OR j."fileKey" = '')
         AND ${scopeOn('j')}
       ORDER BY j."createdAt" ASC
       LIMIT $2`,
  },
  {
    key: 'invoice-file-missing',
    label: 'Invoice with no document uploaded',
    hint: 'Upload the vendor invoice.',
    severity: 'problem',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - i."createdAt")), 0)::int AS "oldestDays"
        FROM site_invoices i
       WHERE i."deletedAt" IS NULL
         AND (i."fileKey" IS NULL OR i."fileKey" = '')
         AND ${scopeOn('i')}`,
    listSql: `
      SELECT i."id", COALESCE(NULLIF(i."invoiceNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             i."totalAmount" AS amount, i."createdAt" AS "since",
             EXTRACT(DAY FROM NOW() - i."createdAt")::int AS "ageDays"
        FROM site_invoices i
        LEFT JOIN sites s ON s."id" = i."siteId"
       WHERE i."deletedAt" IS NULL
         AND (i."fileKey" IS NULL OR i."fileKey" = '')
         AND ${scopeOn('i')}
       ORDER BY i."createdAt" ASC
       LIMIT $2`,
  },

  // ── reported, not flagged ──
  //
  // Part-billing against a PO is ordinary practice, so this is never a red mark. It is here
  // because "what have we not billed yet" is a real question, and burying it among the problems
  // would train people to ignore the list.
  {
    key: 'po-under-invoiced',
    label: 'PO not fully invoiced',
    hint: 'Normal while work is in progress — shown so nothing is forgotten.',
    severity: 'info',
    countSql: `
      SELECT COUNT(*)::int AS count,
             COALESCE(MAX(EXTRACT(DAY FROM NOW() - po."approvalAt")), 0)::int AS "oldestDays"
        FROM purchase_orders po
       WHERE po."deletedAt" IS NULL AND po."approvalStatus" = 'APPROVED'
         AND COALESCE(po."invoicedTotal", 0) < po."totalAmount"
         AND ${scopeOn('po')}`,
    listSql: `
      SELECT po."id", COALESCE(NULLIF(po."poNumber", ''), '(no number)') AS "documentNumber", s."name" AS "siteName",
             (po."totalAmount" - COALESCE(po."invoicedTotal", 0)) AS amount,
             po."approvalAt" AS "since",
             EXTRACT(DAY FROM NOW() - po."approvalAt")::int AS "ageDays"
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
