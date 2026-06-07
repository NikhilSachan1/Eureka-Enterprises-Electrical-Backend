import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GetDocumentStatusDto, DocumentStatusPartyType } from './dto/get-document-status.dto';
import { GetDocumentIssuesDto, SortOrder } from './dto/get-document-issues.dto';
import {
  OverallStatus,
  NEXT_ACTION,
  OVERALL_STATUS_CASE,
} from './constants/document-status.constants';

@Injectable()
export class DocumentStatusService {
  constructor(private readonly dataSource: DataSource) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Endpoint 1 — Site-level summary
  // ─────────────────────────────────────────────────────────────────────────

  async getSummary(query: GetDocumentStatusDto) {
    const {
      siteId,
      companyId,
      partyType,
      page     = 1,
      pageSize = 10,
    } = query;

    const params: any[] = [siteId];
    let paramIdx = 2;

    // Optional companyId filter
    let companyFilter = '';
    if (companyId?.length) {
      companyFilter = `AND s."companyId" = ANY($${paramIdx})`;
      params.push(companyId);
      paramIdx++;
    }

    const limit  = pageSize;
    const offset = (page - 1) * pageSize;
    params.push(limit, offset);
    const limitParam  = paramIdx++;
    const offsetParam = paramIdx++;

    /*
     * Strategy: CTEs for each document type so there is no fan-out
     * (a PO with 3 JMCs must not inflate PO counts, etc.).
     * Each CTE aggregates by siteId + partyType, then the outer SELECT
     * joins them all onto the sites table.
     */
    const sql = `
      WITH
      -- ── POs ──────────────────────────────────────────────────────────────
      po_agg AS (
        SELECT
          "siteId",
          "partyType",
          COUNT(*)                                             AS total,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'APPROVED') AS approved,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'PENDING')  AS pending,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'REJECTED') AS rejected
        FROM purchase_orders
        WHERE "siteId" = ANY($1) AND "deletedAt" IS NULL
        GROUP BY "siteId", "partyType"
      ),

      -- ── JMCs ─────────────────────────────────────────────────────────────
      jmc_agg AS (
        SELECT
          "siteId",
          "partyType",
          COUNT(*)                                             AS total,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'APPROVED') AS approved,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'PENDING')  AS pending,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'REJECTED') AS rejected
        FROM jmcs
        WHERE "siteId" = ANY($1) AND "deletedAt" IS NULL
        GROUP BY "siteId", "partyType"
      ),

      -- ── Reports (PURCHASE only; base = ALL purchase JMCs) ─────────────────
      report_agg AS (
        SELECT
          j."siteId",
          COUNT(j.id)  AS total,
          COUNT(sr.id) AS uploaded,
          COUNT(j.id) - COUNT(sr.id) AS missing
        FROM jmcs j
        LEFT JOIN site_reports sr
               ON sr."jmcId" = j.id AND sr."deletedAt" IS NULL
        WHERE j."siteId" = ANY($1)
          AND j."deletedAt" IS NULL
          AND j."partyType" = 'PURCHASE'
        GROUP BY j."siteId"
      ),

      -- ── Invoices ─────────────────────────────────────────────────────────
      invoice_agg AS (
        SELECT
          "siteId",
          "partyType",
          COUNT(*)                                             AS created,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'APPROVED') AS approved,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'PENDING')  AS pending,
          COUNT(*) FILTER (WHERE "approvalStatus" = 'REJECTED') AS rejected
        FROM site_invoices
        WHERE "siteId" = ANY($1) AND "deletedAt" IS NULL
        GROUP BY "siteId", "partyType"
      ),

      -- ── Book Payments — PURCHASE: applicable = approved invoices ─────────
      book_payment_agg AS (
        SELECT
          si."siteId",
          COUNT(si.id)                          AS applicable,
          COUNT(bp.id)                          AS done,
          COUNT(si.id) - COUNT(bp.id)           AS not_started
        FROM site_invoices si
        LEFT JOIN book_payments bp
               ON bp."invoiceId" = si.id AND bp."deletedAt" IS NULL
        WHERE si."siteId"         = ANY($1)
          AND si."deletedAt"      IS NULL
          AND si."partyType"      = 'PURCHASE'
          AND si."approvalStatus" = 'APPROVED'
        GROUP BY si."siteId"
      ),

      -- ── Bank Transfers PURCHASE — applicable = book payments that exist ──
      purchase_bt_agg AS (
        SELECT
          bp."siteId",
          COUNT(bp.id)                                              AS applicable,
          COUNT(bp.id) FILTER (WHERE bp."hasTransfer" = true)      AS done,
          COUNT(bp.id) FILTER (WHERE bp."hasTransfer" = false)     AS not_started
        FROM book_payments bp
        WHERE bp."siteId" = ANY($1) AND bp."deletedAt" IS NULL
        GROUP BY bp."siteId"
      ),

      -- ── Bank Transfers SALE — applicable = approved invoices ─────────────
      sale_bt_agg AS (
        SELECT
          si."siteId",
          COUNT(si.id)                                                                    AS applicable,
          COUNT(si.id) FILTER (WHERE COALESCE(si."paidTotal",0) >= si."taxableAmount")   AS done,
          COUNT(si.id) FILTER (WHERE COALESCE(si."paidTotal",0) > 0
                                 AND si."paidTotal" < si."taxableAmount")                AS partial,
          COUNT(si.id) FILTER (WHERE COALESCE(si."paidTotal",0) = 0)                    AS not_started
        FROM site_invoices si
        WHERE si."siteId"         = ANY($1)
          AND si."deletedAt"      IS NULL
          AND si."partyType"      = 'SALE'
          AND si."approvalStatus" = 'APPROVED'
        GROUP BY si."siteId"
      ),

      -- ── Total count for pagination ────────────────────────────────────────
      site_count AS (
        SELECT COUNT(*) AS total
        FROM sites s
        WHERE s.id = ANY($1) ${companyFilter} AND s."deletedAt" IS NULL
      )

      SELECT
        s.id          AS "siteId",
        s.name        AS "siteName",
        s."companyId",
        co.name       AS "companyName",
        sc.total      AS "totalRecords",

        -- ── SALE PO ──────────────────────────────────────────────────────────
        COALESCE(spo.total,    0) AS "sale_po_total",
        COALESCE(spo.approved, 0) AS "sale_po_approved",
        COALESCE(spo.pending,  0) AS "sale_po_pending",
        COALESCE(spo.rejected, 0) AS "sale_po_rejected",

        -- ── SALE JMC ─────────────────────────────────────────────────────────
        COALESCE(sjmc.total,    0) AS "sale_jmc_total",
        COALESCE(sjmc.approved, 0) AS "sale_jmc_approved",
        COALESCE(sjmc.pending,  0) AS "sale_jmc_pending",
        COALESCE(sjmc.rejected, 0) AS "sale_jmc_rejected",

        -- ── SALE Invoice (missing = total JMCs − invoices created) ───────────
        COALESCE(sinv.created,  0)                                          AS "sale_invoice_created",
        COALESCE(sinv.approved, 0)                                          AS "sale_invoice_approved",
        COALESCE(sinv.pending,  0)                                          AS "sale_invoice_pending",
        COALESCE(sinv.rejected, 0)                                          AS "sale_invoice_rejected",
        GREATEST(0, COALESCE(sjmc.total,0) - COALESCE(sinv.created,0))     AS "sale_invoice_missing",

        -- ── SALE Bank Transfer ────────────────────────────────────────────────
        COALESCE(sbt.applicable,  0) AS "sale_bt_applicable",
        COALESCE(sbt.done,        0) AS "sale_bt_done",
        COALESCE(sbt.partial,     0) AS "sale_bt_partial",
        COALESCE(sbt.not_started, 0) AS "sale_bt_not_started",

        -- ── PURCHASE PO ──────────────────────────────────────────────────────
        COALESCE(ppo.total,    0) AS "purchase_po_total",
        COALESCE(ppo.approved, 0) AS "purchase_po_approved",
        COALESCE(ppo.pending,  0) AS "purchase_po_pending",
        COALESCE(ppo.rejected, 0) AS "purchase_po_rejected",

        -- ── PURCHASE JMC ─────────────────────────────────────────────────────
        COALESCE(pjmc.total,    0) AS "purchase_jmc_total",
        COALESCE(pjmc.approved, 0) AS "purchase_jmc_approved",
        COALESCE(pjmc.pending,  0) AS "purchase_jmc_pending",
        COALESCE(pjmc.rejected, 0) AS "purchase_jmc_rejected",

        -- ── PURCHASE Report (missing = total PURCHASE JMCs − uploaded) ───────
        COALESCE(pr.total,    0) AS "purchase_report_total",
        COALESCE(pr.uploaded, 0) AS "purchase_report_uploaded",
        COALESCE(pr.missing,  0) AS "purchase_report_missing",

        -- ── PURCHASE Invoice ─────────────────────────────────────────────────
        COALESCE(pinv.created,  0)                                          AS "purchase_invoice_created",
        COALESCE(pinv.approved, 0)                                          AS "purchase_invoice_approved",
        COALESCE(pinv.pending,  0)                                          AS "purchase_invoice_pending",
        COALESCE(pinv.rejected, 0)                                          AS "purchase_invoice_rejected",
        GREATEST(0, COALESCE(pjmc.total,0) - COALESCE(pinv.created,0))     AS "purchase_invoice_missing",

        -- ── PURCHASE Book Payment ─────────────────────────────────────────────
        COALESCE(pbp.applicable,  0) AS "purchase_bp_applicable",
        COALESCE(pbp.done,        0) AS "purchase_bp_done",
        COALESCE(pbp.not_started, 0) AS "purchase_bp_not_started",

        -- ── PURCHASE Bank Transfer ────────────────────────────────────────────
        COALESCE(pbt.applicable,  0) AS "purchase_bt_applicable",
        COALESCE(pbt.done,        0) AS "purchase_bt_done",
        COALESCE(pbt.not_started, 0) AS "purchase_bt_not_started"

      FROM sites s
      CROSS JOIN site_count sc
      JOIN companies co ON co.id = s."companyId" AND co."deletedAt" IS NULL
      -- SALE
      LEFT JOIN po_agg      spo  ON spo."siteId"  = s.id AND spo."partyType"  = 'SALE'
      LEFT JOIN jmc_agg     sjmc ON sjmc."siteId" = s.id AND sjmc."partyType" = 'SALE'
      LEFT JOIN invoice_agg sinv ON sinv."siteId" = s.id AND sinv."partyType" = 'SALE'
      LEFT JOIN sale_bt_agg sbt  ON sbt."siteId"  = s.id
      -- PURCHASE
      LEFT JOIN po_agg           ppo  ON ppo."siteId"  = s.id AND ppo."partyType"  = 'PURCHASE'
      LEFT JOIN jmc_agg          pjmc ON pjmc."siteId" = s.id AND pjmc."partyType" = 'PURCHASE'
      LEFT JOIN report_agg       pr   ON pr."siteId"   = s.id
      LEFT JOIN invoice_agg      pinv ON pinv."siteId" = s.id AND pinv."partyType" = 'PURCHASE'
      LEFT JOIN book_payment_agg pbp  ON pbp."siteId"  = s.id
      LEFT JOIN purchase_bt_agg  pbt  ON pbt."siteId"  = s.id

      WHERE s.id = ANY($1)
        ${companyFilter}
        AND s."deletedAt" IS NULL
      ORDER BY s.name ASC
      LIMIT  $${limitParam}
      OFFSET $${offsetParam}
    `;

    const rows: any[] = await this.dataSource.query(sql, params);
    const totalRecords = rows.length > 0 ? Number(rows[0].totalRecords) : 0;

    const records = rows.map((r) => {
      const showSale     = !partyType || partyType === DocumentStatusPartyType.SALE;
      const showPurchase = !partyType || partyType === DocumentStatusPartyType.PURCHASE;

      // Compute issueCount from all problem indicators
      let issueCount = 0;

      if (showSale) {
        issueCount +=
          Number(r.sale_jmc_pending)      +
          Number(r.sale_jmc_rejected)     +
          Number(r.sale_invoice_missing)  +
          Number(r.sale_invoice_pending)  +
          Number(r.sale_invoice_rejected) +
          Number(r.sale_bt_not_started)   +
          Number(r.sale_bt_partial);
      }

      if (showPurchase) {
        issueCount +=
          Number(r.purchase_jmc_pending)      +
          Number(r.purchase_jmc_rejected)     +
          Number(r.purchase_report_missing)   +
          Number(r.purchase_invoice_missing)  +
          Number(r.purchase_invoice_pending)  +
          Number(r.purchase_invoice_rejected) +
          Number(r.purchase_bp_not_started)   +
          Number(r.purchase_bt_not_started);
      }

      return {
        siteId:      r.siteId,
        siteName:    r.siteName,
        companyId:   r.companyId,
        companyName: r.companyName,

        sale: showSale ? {
          po: {
            total:    Number(r.sale_po_total),
            approved: Number(r.sale_po_approved),
            pending:  Number(r.sale_po_pending),
            rejected: Number(r.sale_po_rejected),
          },
          jmc: {
            total:    Number(r.sale_jmc_total),
            approved: Number(r.sale_jmc_approved),
            pending:  Number(r.sale_jmc_pending),
            rejected: Number(r.sale_jmc_rejected),
          },
          invoice: {
            created:  Number(r.sale_invoice_created),
            approved: Number(r.sale_invoice_approved),
            pending:  Number(r.sale_invoice_pending),
            rejected: Number(r.sale_invoice_rejected),
            missing:  Number(r.sale_invoice_missing),
          },
          bankTransfer: {
            applicable: Number(r.sale_bt_applicable),
            done:       Number(r.sale_bt_done),
            partial:    Number(r.sale_bt_partial),
            notStarted: Number(r.sale_bt_not_started),
          },
        } : null,

        purchase: showPurchase ? {
          po: {
            total:    Number(r.purchase_po_total),
            approved: Number(r.purchase_po_approved),
            pending:  Number(r.purchase_po_pending),
            rejected: Number(r.purchase_po_rejected),
          },
          jmc: {
            total:    Number(r.purchase_jmc_total),
            approved: Number(r.purchase_jmc_approved),
            pending:  Number(r.purchase_jmc_pending),
            rejected: Number(r.purchase_jmc_rejected),
          },
          report: {
            total:    Number(r.purchase_report_total),
            uploaded: Number(r.purchase_report_uploaded),
            missing:  Number(r.purchase_report_missing),
          },
          invoice: {
            created:  Number(r.purchase_invoice_created),
            approved: Number(r.purchase_invoice_approved),
            pending:  Number(r.purchase_invoice_pending),
            rejected: Number(r.purchase_invoice_rejected),
            missing:  Number(r.purchase_invoice_missing),
          },
          bookPayment: {
            applicable: Number(r.purchase_bp_applicable),
            done:       Number(r.purchase_bp_done),
            notStarted: Number(r.purchase_bp_not_started),
          },
          bankTransfer: {
            applicable: Number(r.purchase_bt_applicable),
            done:       Number(r.purchase_bt_done),
            notStarted: Number(r.purchase_bt_not_started),
          },
        } : null,

        issueCount,
        hasIssues: issueCount > 0,
      };
    });

    return { records, totalRecords };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Endpoint 2 — JMC-level drill-down
  // ─────────────────────────────────────────────────────────────────────────

  async getIssues(query: GetDocumentIssuesDto) {
    const {
      siteId,
      companyId,
      partyType,
      overallStatus,
      includeComplete = false,
      dateFrom,
      dateTo,
      sortField  = 'jmcDate',
      sortOrder  = SortOrder.DESC,
      page       = 1,
      pageSize   = 20,
    } = query;

    const params: any[] = [siteId];
    let paramIdx = 2;

    const extraFilters: string[] = [];

    // companyId filter (restricts via site)
    if (companyId?.length) {
      extraFilters.push(`s."companyId" = ANY($${paramIdx})`);
      params.push(companyId);
      paramIdx++;
    }

    // partyType filter
    if (partyType) {
      extraFilters.push(`j."partyType" = $${paramIdx}`);
      params.push(partyType);
      paramIdx++;
    }

    // JMC date range
    if (dateFrom) {
      extraFilters.push(`j."jmcDate" >= $${paramIdx}`);
      params.push(dateFrom);
      paramIdx++;
    }
    if (dateTo) {
      extraFilters.push(`j."jmcDate" <= $${paramIdx}`);
      params.push(dateTo);
      paramIdx++;
    }

    const baseWhere = [
      `j."siteId" = ANY($1)`,
      `j."deletedAt" IS NULL`,
      ...extraFilters,
    ].join(' AND ');

    // overallStatus filter (applied on the CTE alias, not base table)
    const statusFilters: string[] = [];
    if (!includeComplete) {
      statusFilters.push(`chain."overallStatus" != 'COMPLETE'`);
    }
    if (overallStatus?.length) {
      params.push(overallStatus);
      statusFilters.push(`chain."overallStatus" = ANY($${paramIdx})`);
      paramIdx++;
    }
    const statusWhere = statusFilters.length
      ? `WHERE ${statusFilters.join(' AND ')}`
      : '';

    // Sort — whitelist field names to prevent injection
    const allowedSortFields: Record<string, string> = {
      jmcDate:   'j."jmcDate"',
      jmcNumber: 'j."jmcNumber"',
      partyName: 'COALESCE(c.name, v.name)',
      siteName:  's.name',
    };
    const orderBy  = allowedSortFields[sortField] ?? 'j."jmcDate"';
    const orderDir = sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';

    const limit  = pageSize;
    const offset = (page - 1) * pageSize;
    params.push(limit, offset);
    const limitParam  = paramIdx++;
    const offsetParam = paramIdx++;

    const sql = `
      WITH chain AS (
        SELECT
          s.id          AS "siteId",
          s.name        AS "siteName",
          co.name       AS "companyName",

          j.id          AS "jmcId",
          j."jmcNumber",
          j."jmcDate",
          j."partyType",
          j."approvalStatus" AS "jmcStatus",

          COALESCE(c.name, v.name) AS "partyName",

          po.id         AS "poId",
          po."poNumber",
          po."approvalStatus" AS "poStatus",

          sr.id         AS "reportId",

          si.id         AS "invoiceId",
          si."approvalStatus"  AS "invoiceStatus",
          si."taxableAmount"   AS "invoiceTaxableAmount",
          si."totalAmount"     AS "invoiceTotalAmount",
          COALESCE(si."paidTotal", 0) AS "paidTotal",

          bp.id                    AS "bookPaymentId",
          bp."paymentTotalAmount",
          bp."hasTransfer",

          ${OVERALL_STATUS_CASE} AS "overallStatus",

          COUNT(*) OVER() AS "totalRecords"

        FROM jmcs j
        JOIN purchase_orders po
          ON po.id = j."poId" AND po."deletedAt" IS NULL
        JOIN sites s
          ON s.id = j."siteId" AND s."deletedAt" IS NULL
        JOIN companies co
          ON co.id = s."companyId" AND co."deletedAt" IS NULL
        LEFT JOIN contractors c
          ON c.id = j."contractorId" AND c."deletedAt" IS NULL
        LEFT JOIN vendors v
          ON v.id = j."vendorId" AND v."deletedAt" IS NULL
        LEFT JOIN site_reports sr
          ON sr."jmcId" = j.id AND sr."deletedAt" IS NULL
        LEFT JOIN site_invoices si
          ON si."jmcId" = j.id AND si."deletedAt" IS NULL
        LEFT JOIN book_payments bp
          ON bp."invoiceId" = si.id AND bp."deletedAt" IS NULL

        WHERE ${baseWhere}
        ORDER BY ${orderBy} ${orderDir}
      )
      SELECT *
      FROM chain
      ${statusWhere}
      LIMIT  $${limitParam}
      OFFSET $${offsetParam}
    `;

    const rows: any[] = await this.dataSource.query(sql, params);
    const totalRecords = rows.length > 0 ? Number(rows[0].totalRecords) : 0;

    const records = rows.map((r) => this.mapIssueRow(r));
    return { records, totalRecords };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private mapIssueRow(r: any) {
    const status = r.overallStatus as OverallStatus;
    const isPurchase = r.partyType === 'PURCHASE';

    // Dynamic next-action for partial bank transfer
    let nextAction: string | null = NEXT_ACTION[status];
    if (status === OverallStatus.BANK_TRANSFER_PARTIAL && r.invoiceTaxableAmount) {
      const invoiceAmt   = Number(r.invoiceTaxableAmount);
      const transferred  = Number(r.paidTotal);
      const remaining    = invoiceAmt - transferred;
      nextAction = `₹${remaining.toLocaleString('en-IN')} of ₹${invoiceAmt.toLocaleString('en-IN')} remaining to be transferred`;
    }

    // ── Chain: Report ──────────────────────────────────────────────────────
    let reportChain: any;
    if (isPurchase) {
      reportChain = r.reportId
        ? { id: r.reportId, status: 'UPLOADED' }
        : { id: null,       status: 'MISSING'  };
    } else {
      reportChain = { id: null, status: 'N/A' };
    }

    // ── Chain: Invoice ─────────────────────────────────────────────────────
    let invoiceChain: any;
    if (!r.invoiceId) {
      // Determine blocked reason
      const blockedReason =
        isPurchase && !r.reportId
          ? 'Report must be uploaded before invoice can be created'
          : null;
      invoiceChain = {
        id:     null,
        status: blockedReason ? 'BLOCKED' : 'MISSING',
        reason: blockedReason,
        amount: null,
      };
    } else {
      invoiceChain = {
        id:     r.invoiceId,
        status: r.invoiceStatus,
        reason: null,
        amount: r.invoiceTotalAmount ? Number(r.invoiceTotalAmount) : null,
      };
    }

    // ── Chain: Book Payment ────────────────────────────────────────────────
    let bookPaymentChain: any;
    if (!isPurchase) {
      bookPaymentChain = { id: null, status: 'N/A', paymentAmount: null };
    } else if (!r.bookPaymentId) {
      bookPaymentChain = { id: null, status: 'NOT_STARTED', paymentAmount: null };
    } else {
      bookPaymentChain = {
        id:            r.bookPaymentId,
        status:        'DONE',
        paymentAmount: r.paymentTotalAmount ? Number(r.paymentTotalAmount) : null,
      };
    }

    // ── Chain: Bank Transfer ───────────────────────────────────────────────
    let bankTransferChain: any;
    if (!r.invoiceId || r.invoiceStatus !== 'APPROVED') {
      bankTransferChain = {
        status:            'N/A',
        transferredAmount: null,
        invoiceAmount:     null,
        percentage:        null,
      };
    } else if (isPurchase) {
      // PURCHASE: 1:1 with book payment, check hasTransfer flag
      const done = r.hasTransfer === true;
      bankTransferChain = {
        status:            done ? 'DONE' : (r.bookPaymentId ? 'NOT_STARTED' : 'N/A'),
        transferredAmount: done && r.paymentTotalAmount ? Number(r.paymentTotalAmount) : null,
        invoiceAmount:     r.invoiceTaxableAmount ? Number(r.invoiceTaxableAmount) : null,
        percentage:        done ? 100 : 0,
      };
    } else {
      // SALE: multiple partial transfers — use paidTotal vs taxableAmount
      const paidTotal   = Number(r.paidTotal);
      const taxable     = Number(r.invoiceTaxableAmount);
      const percentage  = taxable > 0 ? Math.round((paidTotal / taxable) * 100) : 0;
      const btStatus    = paidTotal >= taxable ? 'DONE'
                        : paidTotal > 0        ? 'PARTIAL'
                        :                        'NOT_STARTED';
      bankTransferChain = {
        status:            btStatus,
        transferredAmount: paidTotal,
        invoiceAmount:     taxable,
        percentage,
      };
    }

    return {
      siteId:      r.siteId,
      siteName:    r.siteName,
      companyName: r.companyName,

      jmcId:      r.jmcId,
      jmcNumber:  r.jmcNumber,
      jmcDate:    r.jmcDate,
      partyType:  r.partyType,
      partyName:  r.partyName ?? null,
      poId:       r.poId,
      poNumber:   r.poNumber,

      overallStatus: status,
      nextAction,

      chain: {
        po: {
          id:     r.poId,
          number: r.poNumber,
          status: r.poStatus,
        },
        jmc: {
          id:     r.jmcId,
          number: r.jmcNumber,
          status: r.jmcStatus,
        },
        report:      reportChain,
        invoice:     invoiceChain,
        bookPayment: bookPaymentChain,
        bankTransfer: bankTransferChain,
      },
    };
  }
}
