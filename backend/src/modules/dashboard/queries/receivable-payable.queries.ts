/**
 * What contractors still owe us, and what we still owe vendors — both read off the invoices.
 *
 * The direction is `partyType`:
 *   SALE      an invoice we raised on a contractor  → money coming in  → receivable
 *   PURCHASE  an invoice a vendor raised on us      → money going out  → payable
 *
 * ## What "still outstanding" means
 *
 *     totalAmount − tdsAmount − advanceSettledAmount − paidTotal
 *
 * Each term earns its place:
 *
 * - **`totalAmount`** is `taxableAmount + gstAmount`, checked against the rows. TDS is *not*
 *   already taken out of it.
 * - **`tdsAmount`** never changes hands. It is withheld and paid to the government, so counting
 *   it as outstanding would overstate every vendor's balance by its TDS — ₹800 on a ₹47,200
 *   invoice, and more where the invoice is larger.
 * - **`advanceSettledAmount`** was paid before the invoice existed; ₹1.47 lakh of it is already
 *   sitting against purchase invoices on dev. Ignoring it would bill ourselves twice.
 * - **`paidTotal`** is the invoice's own rollup rather than a sum of bank transfers. Transfers
 *   link to a *book payment* for purchases, not to the invoice, so joining transfers to invoices
 *   reads zero for every vendor bill. The rollup is right in both directions, and matches the
 *   transfers exactly wherever the two can be compared.
 *
 * Clamped at zero **per invoice**, not on the total: one over-paid row would otherwise quietly
 * cancel out real debt somewhere else. Dev has exactly such a row — ₹2,00,000 recorded against an
 * invoice of ₹0 — and without the clamp it would hide two lakh of genuine receivables.
 *
 * Only APPROVED invoices count towards the headline. One still awaiting approval is not yet an
 * obligation either way; it is reported separately rather than dropped, so nothing is invisible.
 */

/** Cash still to move on one invoice. Expects the invoice aliased as `i`. */
const OUTSTANDING = `GREATEST(
  i."totalAmount"
    - COALESCE(i."tdsAmount", 0)
    - COALESCE(i."advanceSettledAmount", 0)
    - COALESCE(i."paidTotal", 0),
  0
)`;

/**
 * The two headline figures, plus the parts they are made of.
 *
 * `$1` siteId filter (null for all), `$2` companyId filter (null for all).
 */
export const receivablePayableTotalsQuery = `
  SELECT
    i."partyType" AS "partyType",
    COUNT(*)::int AS "invoiceCount",
    COUNT(*) FILTER (WHERE ${OUTSTANDING} > 0)::int AS "openCount",
    COALESCE(SUM(i."totalAmount"), 0)::float AS invoiced,
    COALESCE(SUM(COALESCE(i."tdsAmount", 0)), 0)::float AS tds,
    COALESCE(SUM(COALESCE(i."advanceSettledAmount", 0)), 0)::float AS "advanceSettled",
    COALESCE(SUM(COALESCE(i."paidTotal", 0)), 0)::float AS settled,
    COALESCE(SUM(${OUTSTANDING}), 0)::float AS outstanding,
    COALESCE(MAX(EXTRACT(DAY FROM NOW() - i."invoiceDate")) FILTER (WHERE ${OUTSTANDING} > 0), 0)::int
      AS "oldestDays"
  FROM site_invoices i
  LEFT JOIN sites s ON s."id" = i."siteId"
  WHERE i."deletedAt" IS NULL
    AND i."approvalStatus" = 'APPROVED'
    AND ($1::uuid IS NULL OR i."siteId" = $1::uuid)
    AND ($2::uuid IS NULL OR s."companyId" = $2::uuid)
  GROUP BY i."partyType"
`;

/**
 * The same, per party — which contractor owes us, which vendor we owe.
 *
 * Parties with nothing outstanding are left out: a list of settled accounts is not what anyone
 * opens this screen for.
 *
 * `$1` siteId, `$2` companyId, `$3` party type (`SALE` or `PURCHASE`).
 */
export const outstandingByPartyQuery = `
  SELECT
    COALESCE(c."id", v."id") AS "partyId",
    COALESCE(c."name", v."name", 'Unnamed') AS "partyName",
    COUNT(*)::int AS "invoiceCount",
    COALESCE(SUM(i."totalAmount"), 0)::float AS invoiced,
    COALESCE(SUM(COALESCE(i."paidTotal", 0)), 0)::float AS settled,
    COALESCE(SUM(${OUTSTANDING}), 0)::float AS outstanding,
    COALESCE(MAX(EXTRACT(DAY FROM NOW() - i."invoiceDate")), 0)::int AS "oldestDays"
  FROM site_invoices i
  LEFT JOIN sites s ON s."id" = i."siteId"
  LEFT JOIN contractors c ON c."id" = i."contractorId" AND c."deletedAt" IS NULL
  LEFT JOIN vendors v ON v."id" = i."vendorId" AND v."deletedAt" IS NULL
  WHERE i."deletedAt" IS NULL
    AND i."approvalStatus" = 'APPROVED'
    AND i."partyType" = $3
    AND ${OUTSTANDING} > 0
    AND ($1::uuid IS NULL OR i."siteId" = $1::uuid)
    AND ($2::uuid IS NULL OR s."companyId" = $2::uuid)
  GROUP BY COALESCE(c."id", v."id"), COALESCE(c."name", v."name", 'Unnamed')
  ORDER BY outstanding DESC
`;

/**
 * Invoices still waiting for approval, by direction.
 *
 * Not part of the headline — an unapproved invoice is not yet owed — but reported so a large bill
 * sitting in the approval queue is not a surprise later.
 *
 * `$1` siteId, `$2` companyId.
 */
export const unapprovedInvoiceTotalsQuery = `
  SELECT
    i."partyType" AS "partyType",
    COUNT(*)::int AS "invoiceCount",
    COALESCE(SUM(i."totalAmount"), 0)::float AS amount
  FROM site_invoices i
  LEFT JOIN sites s ON s."id" = i."siteId"
  WHERE i."deletedAt" IS NULL
    AND i."approvalStatus" = 'PENDING'
    AND ($1::uuid IS NULL OR i."siteId" = $1::uuid)
    AND ($2::uuid IS NULL OR s."companyId" = $2::uuid)
  GROUP BY i."partyType"
`;

/**
 * The invoices behind one party's balance.
 *
 * `$1` siteId, `$2` companyId, `$3` party type, `$4` party id, `$5` limit.
 */
export const partyInvoiceListQuery = `
  SELECT
    i."id",
    COALESCE(NULLIF(i."invoiceNumber", ''), '(no number)') AS "invoiceNumber",
    i."invoiceDate",
    s."name" AS "siteName",
    i."totalAmount"::float AS "totalAmount",
    COALESCE(i."tdsAmount", 0)::float AS tds,
    COALESCE(i."advanceSettledAmount", 0)::float AS "advanceSettled",
    COALESCE(i."paidTotal", 0)::float AS settled,
    ${OUTSTANDING}::float AS outstanding,
    EXTRACT(DAY FROM NOW() - i."invoiceDate")::int AS "ageDays"
  FROM site_invoices i
  LEFT JOIN sites s ON s."id" = i."siteId"
  WHERE i."deletedAt" IS NULL
    AND i."approvalStatus" = 'APPROVED'
    AND i."partyType" = $3
    AND COALESCE(i."contractorId", i."vendorId") = $4::uuid
    AND ${OUTSTANDING} > 0
    AND ($1::uuid IS NULL OR i."siteId" = $1::uuid)
    AND ($2::uuid IS NULL OR s."companyId" = $2::uuid)
  ORDER BY i."invoiceDate" ASC
  LIMIT $5
`;
