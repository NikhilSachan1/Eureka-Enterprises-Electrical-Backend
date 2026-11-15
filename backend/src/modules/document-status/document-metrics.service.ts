import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { resolveReadableSiteFilter } from 'src/modules/common/financials/site-access.helper';
import { DocumentStatusPartyType } from './dto/get-document-status.dto';
import { GetDocumentMetricsDto } from './dto/get-document-metrics.dto';

/** Columns a document table has, so each filter is applied only where it makes sense. */
interface ScopeSpec {
  alias: string;
  /** SQL for the document date the date filter applies to. */
  dateExpr: string;
  /** Contractor-side column exists (SALE documents). */
  hasContractor: boolean;
  /** Has a partyType column; when absent the table is PURCHASE-only. */
  hasPartyType: boolean;
}

const APPROVAL_COUNTS = (alias: string): string => `
  COUNT(*)::int                                                          AS total,
  COUNT(*) FILTER (WHERE ${alias}."approvalStatus" = 'APPROVED')::int     AS approved,
  COUNT(*) FILTER (WHERE ${alias}."approvalStatus" = 'PENDING')::int      AS pending,
  COUNT(*) FILTER (WHERE ${alias}."approvalStatus" = 'REJECTED')::int     AS rejected`;

/** Open unlock requests: set on request, cleared when the request is approved or rejected. */
const UNLOCK_REQUESTS = (alias: string): string =>
  `COUNT(*) FILTER (WHERE ${alias}."unlockRequestedAt" IS NOT NULL)::int AS "unlockRequests"`;

const ZERO_APPROVALS = { total: 0, approved: 0, pending: 0, rejected: 0 };

/**
 * Counts for the workspace document tabs: the approval split of each document, its open unlock
 * requests, and what is still owed on it — JMC signed copies, invoices with GST / TDS / payment
 * not settled, bookings with the bank transfer pending, advances not fully adjusted. With no filter the
 * figures cover every site the user can read.
 */
@Injectable()
export class DocumentMetricsService {
  constructor(private readonly dataSource: DataSource) {}

  async getMetrics(query: GetDocumentMetricsDto, userId: string, activeRole?: string) {
    const siteIds = await resolveReadableSiteFilter(
      this.dataSource,
      userId,
      activeRole,
      query.siteId,
    );
    if (siteIds?.length === 0) {
      return this.empty();
    }

    const run = async (spec: ScopeSpec, select: string, from: string) => {
      const scope = this.scope(spec, query, siteIds);
      if (!scope) {
        return null;
      }
      const [row] = await this.dataSource.query(
        `SELECT ${select} FROM ${from} WHERE ${scope.where}`,
        scope.params,
      );
      return row ?? null;
    };

    const [po, jmc, report, invoice, bookPayment, advance, gst, tds] = await Promise.all([
      run(
        { alias: 'po', dateExpr: `po."poDate"`, hasContractor: true, hasPartyType: true },
        `${APPROVAL_COUNTS('po')}, ${UNLOCK_REQUESTS('po')}`,
        'purchase_orders po',
      ),
      run(
        { alias: 'j', dateExpr: `j."jmcDate"`, hasContractor: true, hasPartyType: true },
        `${APPROVAL_COUNTS('j')}, ${UNLOCK_REQUESTS('j')},
         -- Generated contractor JMCs whose signed copy is still not uploaded.
         COUNT(*) FILTER (
           WHERE j."partyType" = 'SALE'
             AND COALESCE(j."isNoJmc", false) = false
             AND (j."fileKey" IS NULL OR j."fileKey" = '')
         )::int AS "signedCopyMissing"`,
        'jmcs j',
      ),
      run(
        { alias: 'r', dateExpr: `r."reportDate"`, hasContractor: true, hasPartyType: true },
        `COUNT(*)::int AS total, ${UNLOCK_REQUESTS('r')}`,
        'site_reports r',
      ),
      run(
        { alias: 'i', dateExpr: `i."invoiceDate"`, hasContractor: true, hasPartyType: true },
        `${APPROVAL_COUNTS('i')}, ${UNLOCK_REQUESTS('i')},
         COUNT(*) FILTER (WHERE i."approvalStatus" = 'APPROVED' AND tax.gst_open)::int AS "gstPendingCount",
         COUNT(*) FILTER (WHERE i."approvalStatus" = 'APPROVED' AND tax.tds_open)::int AS "tdsPendingCount",
         COUNT(*) FILTER (
           WHERE i."approvalStatus" = 'APPROVED'
             AND COALESCE(i."totalAmount", 0) - COALESCE(i."tdsAmount", 0) - st.settled > 0.5
         )::int AS "paymentPendingCount"`,
        // GST open: not matched on the portal, or held GST not yet moved.
        // TDS open: contractor — not verified in 26AS; vendor — challan not deposited or 26Q not filed.
        // Payment open: total − TDS still more than what was settled (transfers, held GST moved
        // later, advance adjusted).
        `site_invoices i
         CROSS JOIN LATERAL (
           SELECT
             EXISTS (
               SELECT 1 FROM gst_register_entries g
                WHERE g."invoiceId" = i.id AND g."deletedAt" IS NULL AND g."gstAmount" > 0
                  AND (
                    NOT COALESCE(g."isVerified", false)
                    OR (g."isGstHold" AND g."gstPaymentId" IS NULL AND g."gstBankTransferId" IS NULL)
                  )
             ) AS gst_open,
             EXISTS (
               SELECT 1 FROM tds_register_entries t
                WHERE t."invoiceId" = i.id AND t."deletedAt" IS NULL AND t."tdsAmount" > 0
                  AND (
                    NOT COALESCE(t."isVerified", false)
                    OR (t."partyType" = 'PURCHASE' AND t."tdsPaymentId" IS NULL)
                  )
             ) AS tds_open
         ) tax
         CROSS JOIN LATERAL (
           SELECT COALESCE(i."paidTotal", 0) + COALESCE(i."advanceSettledAmount", 0) + COALESCE((
             SELECT SUM(bt."transferAmount")
               FROM bank_transfers bt
               LEFT JOIN book_payments gbp ON gbp.id = bt."bookPaymentId"
              WHERE bt."deletedAt" IS NULL
                AND bt."paymentType" = 'GST'
                AND COALESCE(bt."invoiceId", gbp."invoiceId") = i.id
           ), 0) AS settled
         ) st`,
      ),
      run(
        { alias: 'bp', dateExpr: `bp."bookingDate"`, hasContractor: false, hasPartyType: false },
        // Approved bookings still waiting for their bank transfer.
        `COUNT(*)::int AS total, ${UNLOCK_REQUESTS('bp')},
         COUNT(*) FILTER (
           WHERE bp."approvalStatus" = 'APPROVED' AND NOT COALESCE(bp."hasTransfer", false)
         )::int AS "transferPendingCount"`,
        'book_payments bp',
      ),
      run(
        { alias: 'a', dateExpr: `a."advanceDate"`, hasContractor: false, hasPartyType: false },
        // Approved advances with part of their amount not yet adjusted against an invoice.
        `${APPROVAL_COUNTS('a')},
         COUNT(*) FILTER (
           WHERE a."approvalStatus" = 'APPROVED' AND a.amount - COALESCE(a."settledAmount", 0) > 0.5
         )::int AS "unadjustedCount",
         COALESCE(SUM(a.amount - COALESCE(a."settledAmount", 0)) FILTER (
           WHERE a."approvalStatus" = 'APPROVED' AND a.amount - COALESCE(a."settledAmount", 0) > 0.5
         ), 0)::numeric AS "unadjustedAmount"`,
        'advance_payments a',
      ),
      run(
        // GST register entries carry no date of their own: filter on their invoice date.
        {
          alias: 'g',
          dateExpr: `(SELECT gi."invoiceDate" FROM site_invoices gi WHERE gi.id = g."invoiceId")`,
          hasContractor: true,
          hasPartyType: true,
        },
        `COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE COALESCE(g."isVerified", false))::int AS verified,
         COUNT(*) FILTER (WHERE NOT COALESCE(g."isVerified", false))::int AS "verificationPending",
         -- Held GST: PENDING → IN_PROCESS (release booked, not transferred) → SETTLED.
         COUNT(*) FILTER (
           WHERE g."isGstHold" AND g."gstPaymentId" IS NULL AND g."gstBankTransferId" IS NULL
             AND g."gstBookPaymentId" IS NULL
         )::int AS "holdPending",
         COUNT(*) FILTER (
           WHERE g."isGstHold" AND g."gstPaymentId" IS NULL AND g."gstBankTransferId" IS NULL
             AND g."gstBookPaymentId" IS NOT NULL
         )::int AS "holdInProcess",
         COUNT(*) FILTER (
           WHERE g."isGstHold" AND (g."gstPaymentId" IS NOT NULL OR g."gstBankTransferId" IS NOT NULL)
         )::int AS "holdSettled",
         COALESCE(SUM(g."gstAmount") FILTER (
           WHERE g."isGstHold" AND g."gstPaymentId" IS NULL AND g."gstBankTransferId" IS NULL
         ), 0)::numeric AS "holdPendingAmount"`,
        'gst_register_entries g',
      ),
      run(
        {
          alias: 't',
          dateExpr: `(SELECT ti."invoiceDate" FROM site_invoices ti WHERE ti.id = t."invoiceId")`,
          hasContractor: true,
          hasPartyType: true,
        },
        // Verified: 26Q (vendor) / 26AS (contractor). Challan: vendor TDS we deposit.
        `COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE COALESCE(t."isVerified", false))::int AS verified,
         COUNT(*) FILTER (WHERE NOT COALESCE(t."isVerified", false))::int AS "verificationPending",
         COUNT(*) FILTER (WHERE t."partyType" = 'PURCHASE' AND t."tdsPaymentId" IS NOT NULL)::int AS "challanDeposited",
         COUNT(*) FILTER (WHERE t."partyType" = 'PURCHASE' AND t."tdsPaymentId" IS NULL)::int AS "challanPending",
         COALESCE(SUM(t."tdsAmount") FILTER (
           WHERE t."partyType" = 'PURCHASE' AND t."tdsPaymentId" IS NULL
         ), 0)::numeric AS "challanPendingAmount"`,
        'tds_register_entries t',
      ),
    ]);

    const counts = (row: Record<string, unknown> | null) => ({
      total: this.int(row?.total),
      approved: this.int(row?.approved),
      pending: this.int(row?.pending),
      rejected: this.int(row?.rejected),
    });

    return {
      po: { ...counts(po), unlockRequests: this.int(po?.unlockRequests) },
      jmc: {
        ...counts(jmc),
        unlockRequests: this.int(jmc?.unlockRequests),
        signedCopyMissing: this.int(jmc?.signedCopyMissing),
      },
      report: { total: this.int(report?.total), unlockRequests: this.int(report?.unlockRequests) },
      invoice: {
        ...counts(invoice),
        unlockRequests: this.int(invoice?.unlockRequests),
        gstPendingCount: this.int(invoice?.gstPendingCount),
        tdsPendingCount: this.int(invoice?.tdsPendingCount),
        paymentPendingCount: this.int(invoice?.paymentPendingCount),
      },
      bookPayment: {
        total: this.int(bookPayment?.total),
        unlockRequests: this.int(bookPayment?.unlockRequests),
        transferPendingCount: this.int(bookPayment?.transferPendingCount),
      },
      advance: {
        ...counts(advance),
        unadjustedCount: this.int(advance?.unadjustedCount),
        unadjustedAmount: this.num(advance?.unadjustedAmount),
      },
      gst: {
        total: this.int(gst?.total),
        verified: this.int(gst?.verified),
        verificationPending: this.int(gst?.verificationPending),
        holdPending: this.int(gst?.holdPending),
        holdInProcess: this.int(gst?.holdInProcess),
        holdSettled: this.int(gst?.holdSettled),
        holdPendingAmount: this.num(gst?.holdPendingAmount),
      },
      tds: {
        total: this.int(tds?.total),
        verified: this.int(tds?.verified),
        verificationPending: this.int(tds?.verificationPending),
        challanDeposited: this.int(tds?.challanDeposited),
        challanPending: this.int(tds?.challanPending),
        challanPendingAmount: this.num(tds?.challanPendingAmount),
      },
    };
  }

  /**
   * WHERE clause for one document table. Returns null when a filter cannot match the table at
   * all (e.g. a contractor filter on vendor-only bookings), so its figures stay zero.
   */
  private scope(
    spec: ScopeSpec,
    query: GetDocumentMetricsDto,
    siteIds: string[] | null,
  ): { where: string; params: unknown[] } | null {
    const { alias: t } = spec;
    const params: unknown[] = [];
    const where: string[] = [`${t}."deletedAt" IS NULL`];
    const add = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (siteIds) {
      where.push(`${t}."siteId" = ANY(${add(siteIds)}::uuid[])`);
    }
    if (query.companyId?.length) {
      where.push(
        `${t}."siteId" IN (SELECT s.id FROM sites s WHERE s."companyId" = ANY(${add(
          query.companyId,
        )}::uuid[]))`,
      );
    }
    if (query.partyType) {
      if (!spec.hasPartyType && query.partyType !== DocumentStatusPartyType.PURCHASE) {
        return null;
      }
      if (spec.hasPartyType) {
        where.push(`${t}."partyType" = ${add(query.partyType)}`);
      }
    }
    if (query.contractorId?.length) {
      if (!spec.hasContractor) {
        return null;
      }
      where.push(`${t}."contractorId" = ANY(${add(query.contractorId)}::uuid[])`);
    }
    if (query.vendorId?.length) {
      where.push(`${t}."vendorId" = ANY(${add(query.vendorId)}::uuid[])`);
    }
    if (query.dateFrom) {
      where.push(`(${spec.dateExpr})::date >= ${add(query.dateFrom)}::date`);
    }
    if (query.dateTo) {
      where.push(`(${spec.dateExpr})::date <= ${add(query.dateTo)}::date`);
    }

    return { where: where.join(' AND '), params };
  }

  private empty() {
    return {
      po: { ...ZERO_APPROVALS, unlockRequests: 0 },
      jmc: { ...ZERO_APPROVALS, unlockRequests: 0, signedCopyMissing: 0 },
      report: { total: 0, unlockRequests: 0 },
      invoice: {
        ...ZERO_APPROVALS,
        unlockRequests: 0,
        gstPendingCount: 0,
        tdsPendingCount: 0,
        paymentPendingCount: 0,
      },
      bookPayment: { total: 0, unlockRequests: 0, transferPendingCount: 0 },
      advance: { ...ZERO_APPROVALS, unadjustedCount: 0, unadjustedAmount: 0 },
      gst: {
        total: 0,
        verified: 0,
        verificationPending: 0,
        holdPending: 0,
        holdInProcess: 0,
        holdSettled: 0,
        holdPendingAmount: 0,
      },
      tds: {
        total: 0,
        verified: 0,
        verificationPending: 0,
        challanDeposited: 0,
        challanPending: 0,
        challanPendingAmount: 0,
      },
    };
  }

  private int(value: unknown): number {
    return parseInt(String(value ?? '0'), 10) || 0;
  }

  private num(value: unknown): number {
    return Math.round((parseFloat(String(value ?? '0')) || 0) * 100) / 100;
  }
}
