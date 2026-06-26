import { GetVendorListQueryDto } from '../dto/get-vendor-list-query.dto';

/**
 * Builds three queries for the vendor-list endpoint:
 *   1. vendorIdsQuery  — paginates over distinct vendorIds that match the filters
 *   2. detailQuery     — fetches all fully-joined book payment rows for those vendors
 *   3. countQuery      — total distinct-vendor count (for totalRecords)
 *   4. summaryQuery    — global aggregate across all matching book payments
 *
 * Strategy: paginate on vendor, then pull all their book payments in one join query
 * and group in JS. This avoids a cartesian explosion while keeping a single round-trip.
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

  const whereConditions: string[] = [];
  const params: any[] = [];
  let pi = 1; // param index

  // Only approved, non-deleted book payments
  whereConditions.push(`bp."approvalStatus" = $${pi++}`);
  params.push('APPROVED');

  whereConditions.push(`bp."deletedAt" IS NULL`);

  // Only book payments still awaiting a bank transfer (payout pending)
  whereConditions.push(`bp."hasTransfer" = false`);

  if (vendorIds && vendorIds.length > 0) {
    whereConditions.push(`bp."vendorId" = ANY($${pi++})`);
    params.push(vendorIds);
  }

  if (siteIds && siteIds.length > 0) {
    whereConditions.push(`bp."siteId" = ANY($${pi++})`);
    params.push(siteIds);
  }

  if (companyIds && companyIds.length > 0) {
    whereConditions.push(`s."companyId" = ANY($${pi++})`);
    params.push(companyIds);
  }

  if (startDate) {
    whereConditions.push(`bp."bookingDate" >= $${pi++}`);
    params.push(startDate);
  }

  if (endDate) {
    whereConditions.push(`bp."bookingDate" <= $${pi++}`);
    params.push(endDate);
  }

  if (search) {
    whereConditions.push(`(
      LOWER(v."name") LIKE LOWER($${pi}) OR
      LOWER(inv."invoiceNumber") LIKE LOWER($${pi}) OR
      LOWER(po."poNumber") LIKE LOWER($${pi})
    )`);
    params.push(`%${search}%`);
    pi++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Base join fragment shared by all queries
  const baseJoin = `
    FROM "book_payments" bp
    INNER JOIN "site_invoices" inv  ON inv."id"        = bp."invoiceId"  AND inv."deletedAt" IS NULL
    LEFT  JOIN "jmcs"          jmc  ON jmc."id"        = inv."jmcId"     AND jmc."deletedAt" IS NULL
    LEFT  JOIN "purchase_orders" po ON po."id"         = jmc."poId"      AND po."deletedAt" IS NULL
    INNER JOIN "sites"         s    ON s."id"          = bp."siteId"     AND s."deletedAt" IS NULL
    INNER JOIN "companies"     c    ON c."id"          = s."companyId"   AND c."deletedAt" IS NULL
    INNER JOIN "vendors"       v    ON v."id"          = bp."vendorId"   AND v."deletedAt" IS NULL
  `;

  // 1. Count of distinct vendors
  const countQuery = `
    SELECT COUNT(DISTINCT bp."vendorId") AS total
    ${baseJoin}
    ${whereClause}
  `;

  // 2. Paginated vendor IDs
  let vendorIdsQuery = `
    SELECT DISTINCT bp."vendorId"
    ${baseJoin}
    ${whereClause}
    ORDER BY bp."vendorId"
  `;

  const vendorIdsParams = [...params];
  if (pageSize !== undefined) {
    const offset = (page - 1) * pageSize;
    vendorIdsQuery += ` LIMIT $${pi} OFFSET $${pi + 1}`;
    vendorIdsParams.push(pageSize, offset);
  }

  // 3. Full detail query — called after we have the vendor IDs page
  //    Caller passes vendorIds as an extra param at the end.
  const detailQuery = `
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

    ${baseJoin}
    WHERE bp."approvalStatus" = 'APPROVED'
      AND bp."deletedAt" IS NULL
      AND bp."hasTransfer" = false
      AND bp."vendorId" = ANY($1)
    ORDER BY v."name" ASC, bp."bookingDate" ${order}
  `;

  // 4. Global summary query (across all matching book payments, not just page)
  const summaryQuery = `
    SELECT
      COUNT(DISTINCT bp."vendorId")                                            AS "totalVendors",
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
    ${baseJoin}
    ${whereClause}
  `;

  return {
    countQuery,
    countParams: params,
    vendorIdsQuery,
    vendorIdsParams,
    detailQuery,
    summaryQuery,
    summaryParams: params,
  };
};
