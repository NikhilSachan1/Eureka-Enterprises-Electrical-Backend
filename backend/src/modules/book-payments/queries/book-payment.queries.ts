import { GetVendorListQueryDto } from '../dto/get-vendor-list-query.dto';

/**
 * Builds the queries for the vendor-list endpoint.
 *
 * The vendor set is the UNION of:
 *   (a) vendors with approved, un-transferred book payments (payout pending), and
 *   (b) vendors with approved PURCHASE invoices that still have an un-booked balance
 *       (bookedTotal < net payable) — i.e. money yet to be booked.
 *
 * For the paginated page of vendors we then pull, per vendor:
 *   - their pending book payments  (bookPaymentDetailQuery)
 *   - their un-booked invoices      (unbookedInvoiceDetailQuery)
 * and two global summaries (book payments + un-booked invoices).
 *
 * Net payable (invoice): isGstHold ? taxable − tds : taxable + gst − tds.
 * Pending to book        = net payable − bookedTotal.
 */
export const buildVendorListQuery = (filters: GetVendorListQueryDto) => {
  const {
    page = 1,
    pageSize,
    sortOrder = 'DESC',
    vendorIds,
    siteIds,
    companyIds,
    startDate,
    endDate,
    search,
  } = filters;

  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  // Placeholder helper bound to a specific params array.
  const mkPh = (params: any[]) => (val: any) => {
    params.push(val);
    return `$${params.length}`;
  };

  // ── Invoice net-payable / pending-to-book expressions (inv alias) ──
  const invNetPayable = `(CASE WHEN inv."isGstHold" = true
      THEN COALESCE(inv."taxableAmount"::numeric, 0) - COALESCE(inv."tdsAmount"::numeric, 0)
      ELSE COALESCE(inv."taxableAmount"::numeric, 0) + COALESCE(inv."gstAmount"::numeric, 0) - COALESCE(inv."tdsAmount"::numeric, 0)
    END)`;
  const invPendingToBook = `(${invNetPayable} - COALESCE(inv."bookedTotal"::numeric, 0))`;

  // ── Join fragments ──
  const bookPaymentJoin = `
    FROM "book_payments" bp
    INNER JOIN "site_invoices" inv  ON inv."id"        = bp."invoiceId"  AND inv."deletedAt" IS NULL
    LEFT  JOIN "jmcs"          jmc  ON jmc."id"        = inv."jmcId"     AND jmc."deletedAt" IS NULL
    LEFT  JOIN "purchase_orders" po ON po."id"         = jmc."poId"      AND po."deletedAt" IS NULL
    INNER JOIN "sites"         s    ON s."id"          = bp."siteId"     AND s."deletedAt" IS NULL
    INNER JOIN "companies"     c    ON c."id"          = s."companyId"   AND c."deletedAt" IS NULL
    INNER JOIN "vendors"       v    ON v."id"          = bp."vendorId"   AND v."deletedAt" IS NULL
  `;
  const invoiceJoin = `
    FROM "site_invoices" inv
    LEFT  JOIN "jmcs"          jmc  ON jmc."id"        = inv."jmcId"     AND jmc."deletedAt" IS NULL
    LEFT  JOIN "purchase_orders" po ON po."id"         = jmc."poId"      AND po."deletedAt" IS NULL
    INNER JOIN "sites"         s    ON s."id"          = inv."siteId"    AND s."deletedAt" IS NULL
    INNER JOIN "companies"     c    ON c."id"          = s."companyId"   AND c."deletedAt" IS NULL
    INNER JOIN "vendors"       v    ON v."id"          = inv."vendorId"  AND v."deletedAt" IS NULL
  `;

  // ── WHERE builders (filters applied per source) ──
  const bookPaymentWhere = (ph: (v: any) => string) => {
    const c = [
      `bp."approvalStatus" = 'APPROVED'`,
      `bp."deletedAt" IS NULL`,
      `bp."hasTransfer" = false`,
    ];
    if (vendorIds?.length) c.push(`bp."vendorId" = ANY(${ph(vendorIds)})`);
    if (siteIds?.length) c.push(`bp."siteId" = ANY(${ph(siteIds)})`);
    if (companyIds?.length) c.push(`s."companyId" = ANY(${ph(companyIds)})`);
    if (startDate) c.push(`bp."bookingDate" >= ${ph(startDate)}`);
    if (endDate) c.push(`bp."bookingDate" <= ${ph(endDate)}`);
    if (search) {
      const p = ph(`%${search}%`);
      c.push(
        `(LOWER(v."name") LIKE LOWER(${p}) OR LOWER(inv."invoiceNumber") LIKE LOWER(${p}) OR LOWER(po."poNumber") LIKE LOWER(${p}))`,
      );
    }
    return c.join(' AND ');
  };
  const invoiceWhere = (ph: (v: any) => string) => {
    const c = [
      `inv."partyType" = 'PURCHASE'`,
      `inv."approvalStatus" = 'APPROVED'`,
      `inv."deletedAt" IS NULL`,
      `inv."vendorId" IS NOT NULL`,
      `${invPendingToBook} > 0.01`,
    ];
    if (vendorIds?.length) c.push(`inv."vendorId" = ANY(${ph(vendorIds)})`);
    if (siteIds?.length) c.push(`inv."siteId" = ANY(${ph(siteIds)})`);
    if (companyIds?.length) c.push(`s."companyId" = ANY(${ph(companyIds)})`);
    if (startDate) c.push(`inv."invoiceDate" >= ${ph(startDate)}`);
    if (endDate) c.push(`inv."invoiceDate" <= ${ph(endDate)}`);
    if (search) {
      const p = ph(`%${search}%`);
      c.push(
        `(LOWER(v."name") LIKE LOWER(${p}) OR LOWER(inv."invoiceNumber") LIKE LOWER(${p}) OR LOWER(po."poNumber") LIKE LOWER(${p}))`,
      );
    }
    return c.join(' AND ');
  };

  // ── 1+2. Union vendor set → count + paginated vendor ids ──
  const unionParams: any[] = [];
  const uph = mkPh(unionParams);
  const unionSql = `
    SELECT bp."vendorId" AS vid
    ${bookPaymentJoin}
    WHERE ${bookPaymentWhere(uph)}
    UNION
    SELECT inv."vendorId" AS vid
    ${invoiceJoin}
    WHERE ${invoiceWhere(uph)}
  `;

  const countQuery = `SELECT COUNT(*) AS total FROM (${unionSql}) u`;
  const countParams = unionParams;

  let vendorIdsQuery = `
    SELECT u.vid AS "vendorId"
    FROM (${unionSql}) u
    INNER JOIN "vendors" v ON v."id" = u.vid AND v."deletedAt" IS NULL
    ORDER BY v."name" ASC, u.vid
  `;
  const vendorIdsParams = [...unionParams];
  if (pageSize !== undefined) {
    const offset = (page - 1) * pageSize;
    vendorIdsQuery += ` LIMIT $${vendorIdsParams.length + 1} OFFSET $${vendorIdsParams.length + 2}`;
    vendorIdsParams.push(pageSize, offset);
  }

  // ── 3. Book payment detail (by vendor page) — $1 = vendorIds ──
  const bookPaymentDetailQuery = `
    SELECT
      bp."id"                   AS "bpId",
      bp."bookingDate",
      bp."taxableAmount",
      bp."gstAmount",
      bp."gstPercentage",
      bp."paymentTotalAmount",
      bp."paymentHoldAmount",
      bp."paymentHoldReason",
      bp."remarks",
      bp."approvalStatus",
      bp."hasTransfer",

      v."id"                    AS "vendorId",
      v."name"                  AS "vendorName",
      v."city"                  AS "vendorCity",
      v."state"                 AS "vendorState",
      v."contactNumber"         AS "vendorContact",
      v."email"                 AS "vendorEmail",
      v."accountHolderName"     AS "vendorAccountHolderName",
      v."bankName"              AS "vendorBankName",
      v."accountNumber"         AS "vendorAccountNumber",
      v."ifscCode"              AS "vendorIfscCode",

      inv."id"                  AS "invoiceId",
      inv."invoiceNumber",
      inv."invoiceDate",
      inv."totalAmount"         AS "invoiceTotalAmount",
      inv."tdsAmount"           AS "invoiceTdsAmount",
      inv."isGstHold"           AS "invoiceIsGstHold",
      inv."approvalStatus"      AS "invoiceApprovalStatus",

      jmc."id"                  AS "jmcId",
      jmc."jmcNumber",
      jmc."jmcDate",

      po."id"                   AS "poId",
      po."poNumber",
      po."poDate",
      po."totalAmount"          AS "poTotalAmount",

      s."id"                    AS "siteId",
      s."name"                  AS "siteName",
      s."city"                  AS "siteCity",
      s."state"                 AS "siteState",

      c."id"                    AS "companyId",
      c."name"                  AS "companyName"

    ${bookPaymentJoin}
    WHERE bp."approvalStatus" = 'APPROVED'
      AND bp."deletedAt" IS NULL
      AND bp."hasTransfer" = false
      AND bp."vendorId" = ANY($1)
    ORDER BY v."name" ASC, bp."bookingDate" ${order}
  `;

  // ── 4. Un-booked invoice detail (by vendor page) — $1 = vendorIds ──
  const unbookedInvoiceDetailQuery = `
    SELECT
      inv."id"                  AS "invoiceId",
      inv."invoiceNumber",
      inv."invoiceDate",
      inv."taxableAmount",
      inv."gstAmount",
      inv."gstPercentage",
      inv."tdsAmount",
      inv."isGstHold",
      inv."totalAmount"         AS "invoiceTotalAmount",
      inv."bookedTotal",
      inv."approvalStatus"      AS "invoiceApprovalStatus",
      ${invNetPayable}          AS "netPayableAmount",
      ${invPendingToBook}       AS "pendingToBook",

      v."id"                    AS "vendorId",
      v."name"                  AS "vendorName",
      v."city"                  AS "vendorCity",
      v."state"                 AS "vendorState",
      v."contactNumber"         AS "vendorContact",
      v."email"                 AS "vendorEmail",
      v."accountHolderName"     AS "vendorAccountHolderName",
      v."bankName"              AS "vendorBankName",
      v."accountNumber"         AS "vendorAccountNumber",
      v."ifscCode"              AS "vendorIfscCode",

      jmc."id"                  AS "jmcId",
      jmc."jmcNumber",
      jmc."jmcDate",

      po."id"                   AS "poId",
      po."poNumber",
      po."poDate",
      po."totalAmount"          AS "poTotalAmount",

      s."id"                    AS "siteId",
      s."name"                  AS "siteName",
      s."city"                  AS "siteCity",
      s."state"                 AS "siteState",

      c."id"                    AS "companyId",
      c."name"                  AS "companyName"

    ${invoiceJoin}
    WHERE inv."partyType" = 'PURCHASE'
      AND inv."approvalStatus" = 'APPROVED'
      AND inv."deletedAt" IS NULL
      AND inv."vendorId" = ANY($1)
      AND ${invPendingToBook} > 0.01
    ORDER BY v."name" ASC, inv."invoiceDate" ${order}
  `;

  // ── 5. Book payment global summary ──
  const bookPaymentSummaryParams: any[] = [];
  const bsph = mkPh(bookPaymentSummaryParams);
  const bookPaymentSummaryQuery = `
    SELECT
      COUNT(bp."id")                                                           AS "totalBookPayments",
      COALESCE(SUM(bp."taxableAmount"::numeric), 0)                           AS "totalTaxableAmount",
      COALESCE(SUM(bp."gstAmount"::numeric), 0)                               AS "totalGstAmount",
      COALESCE(SUM(bp."paymentTotalAmount"::numeric), 0)                      AS "totalPaymentAmount",
      COALESCE(SUM(bp."paymentHoldAmount"::numeric), 0)                       AS "totalHoldAmount",
      COALESCE(SUM(COALESCE(inv."tdsAmount"::numeric, 0)), 0)                 AS "totalTdsAmount",
      COALESCE(SUM(
        CASE WHEN inv."isGstHold" = true
          THEN bp."taxableAmount"::numeric - COALESCE(inv."tdsAmount"::numeric, 0)
          ELSE bp."taxableAmount"::numeric + bp."gstAmount"::numeric - COALESCE(inv."tdsAmount"::numeric, 0)
        END
      ), 0)                                                                    AS "totalNetPayableAmount"
    ${bookPaymentJoin}
    WHERE ${bookPaymentWhere(bsph)}
  `;

  // ── 6. Un-booked invoice global summary ──
  const unbookedInvoiceSummaryParams: any[] = [];
  const isph = mkPh(unbookedInvoiceSummaryParams);
  const unbookedInvoiceSummaryQuery = `
    SELECT
      COUNT(inv."id")                          AS "totalUnbookedInvoices",
      COALESCE(SUM(${invPendingToBook}), 0)    AS "totalPendingToBook"
    ${invoiceJoin}
    WHERE ${invoiceWhere(isph)}
  `;

  return {
    countQuery,
    countParams,
    vendorIdsQuery,
    vendorIdsParams,
    bookPaymentDetailQuery,
    unbookedInvoiceDetailQuery,
    bookPaymentSummaryQuery,
    bookPaymentSummaryParams,
    unbookedInvoiceSummaryQuery,
    unbookedInvoiceSummaryParams,
  };
};
