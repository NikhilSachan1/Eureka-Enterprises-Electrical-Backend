import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { resolveReadableSiteFilter } from 'src/modules/common/financials/site-access.helper';
import { DocumentStatusPartyType } from './dto/get-document-status.dto';
import { GetDocumentMetricsDto } from './dto/get-document-metrics.dto';

/** Columns a document table has, so each filter is applied only where it makes sense. */
interface ScopeSpec {
  alias: string;
  dateColumn: string;
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

const ZERO_APPROVALS = { total: 0, approved: 0, pending: 0, rejected: 0 };

/**
 * Counts and amounts for the workspace document tabs: approvals for every document, plus what
 * matters for each — JMC signed copies, invoice settlement, bookings awaiting transfer, advance
 * balance. With no filter the figures cover every site the user can read.
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

    const [po, jmc, report, invoice, bookPayment, advance] = await Promise.all([
      run(
        { alias: 'po', dateColumn: 'poDate', hasContractor: true, hasPartyType: true },
        APPROVAL_COUNTS('po'),
        'purchase_orders po',
      ),
      run(
        { alias: 'j', dateColumn: 'jmcDate', hasContractor: true, hasPartyType: true },
        `${APPROVAL_COUNTS('j')},
         -- Generated contractor JMCs whose signed copy is still not uploaded.
         COUNT(*) FILTER (
           WHERE j."partyType" = 'SALE'
             AND COALESCE(j."isNoJmc", false) = false
             AND (j."fileKey" IS NULL OR j."fileKey" = '')
         )::int AS "signedCopyMissing"`,
        'jmcs j',
      ),
      run(
        { alias: 'r', dateColumn: 'reportDate', hasContractor: true, hasPartyType: true },
        APPROVAL_COUNTS('r'),
        'site_reports r',
      ),
      run(
        { alias: 'i', dateColumn: 'invoiceDate', hasContractor: true, hasPartyType: true },
        `${APPROVAL_COUNTS('i')},
         COALESCE(SUM(i."taxableAmount") FILTER (WHERE i."approvalStatus" = 'APPROVED'), 0)::numeric AS "taxableAmount",
         COALESCE(SUM(i."gstAmount") FILTER (WHERE i."approvalStatus" = 'APPROVED'), 0)::numeric     AS "gstAmount",
         COALESCE(SUM(i."totalAmount") FILTER (WHERE i."approvalStatus" = 'APPROVED'), 0)::numeric   AS "invoiceAmount",
         COALESCE(SUM(st.settled) FILTER (WHERE i."approvalStatus" = 'APPROVED'), 0)::numeric        AS "settledAmount",
         COALESCE(SUM(GREATEST(
           COALESCE(i."totalAmount", 0) - COALESCE(i."tdsAmount", 0) - st.settled, 0
         )) FILTER (WHERE i."approvalStatus" = 'APPROVED'), 0)::numeric                              AS "outstandingAmount",
         COUNT(*) FILTER (WHERE i."approvalStatus" = 'APPROVED' AND i."isGstHold")::int              AS "gstHoldCount"`,
        // Settled against an invoice: regular transfers, held GST moved later, advance adjusted.
        `site_invoices i
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
        { alias: 'bp', dateColumn: 'bookingDate', hasContractor: false, hasPartyType: false },
        `${APPROVAL_COUNTS('bp')},
         COALESCE(SUM(bp."paymentTotalAmount") FILTER (WHERE bp."approvalStatus" = 'APPROVED'), 0)::numeric AS "bookedAmount",
         COUNT(*) FILTER (
           WHERE bp."approvalStatus" = 'APPROVED' AND NOT COALESCE(bp."hasTransfer", false)
         )::int AS "awaitingTransferCount",
         COALESCE(SUM(bp."paymentTotalAmount" - COALESCE(bp."paymentHoldAmount", 0)) FILTER (
           WHERE bp."approvalStatus" = 'APPROVED' AND NOT COALESCE(bp."hasTransfer", false)
         ), 0)::numeric AS "awaitingTransferAmount",
         COALESCE(SUM(bp."paymentHoldAmount") FILTER (WHERE bp."approvalStatus" = 'APPROVED'), 0)::numeric AS "holdAmount"`,
        'book_payments bp',
      ),
      run(
        { alias: 'a', dateColumn: 'advanceDate', hasContractor: false, hasPartyType: false },
        `${APPROVAL_COUNTS('a')},
         COALESCE(SUM(a.amount) FILTER (WHERE a."approvalStatus" = 'APPROVED'), 0)::numeric AS "advanceAmount",
         COALESCE(SUM(paid.amount) FILTER (WHERE a."approvalStatus" = 'APPROVED'), 0)::numeric AS "paidAmount",
         COALESCE(SUM(GREATEST(a.amount - COALESCE(a."settledAmount", 0), 0)) FILTER (
           WHERE a."approvalStatus" = 'APPROVED'
         ), 0)::numeric AS "unadjustedAmount"`,
        // Paid = bank transfers of the bookings raised against the advance.
        `advance_payments a
         CROSS JOIN LATERAL (
           SELECT COALESCE(SUM(bt."transferAmount"), 0) AS amount
             FROM book_payments abp
             JOIN bank_transfers bt ON bt."bookPaymentId" = abp.id AND bt."deletedAt" IS NULL
            WHERE abp."advancePaymentId" = a.id AND abp."deletedAt" IS NULL
         ) paid`,
      ),
    ]);

    const counts = (row: Record<string, unknown> | null) => ({
      total: this.int(row?.total),
      approved: this.int(row?.approved),
      pending: this.int(row?.pending),
      rejected: this.int(row?.rejected),
    });

    return {
      po: counts(po),
      jmc: { ...counts(jmc), signedCopyMissing: this.int(jmc?.signedCopyMissing) },
      report: counts(report),
      invoice: {
        ...counts(invoice),
        taxableAmount: this.num(invoice?.taxableAmount),
        gstAmount: this.num(invoice?.gstAmount),
        invoiceAmount: this.num(invoice?.invoiceAmount),
        settledAmount: this.num(invoice?.settledAmount),
        outstandingAmount: this.num(invoice?.outstandingAmount),
        gstHoldCount: this.int(invoice?.gstHoldCount),
      },
      bookPayment: {
        ...counts(bookPayment),
        bookedAmount: this.num(bookPayment?.bookedAmount),
        awaitingTransferCount: this.int(bookPayment?.awaitingTransferCount),
        awaitingTransferAmount: this.num(bookPayment?.awaitingTransferAmount),
        holdAmount: this.num(bookPayment?.holdAmount),
      },
      advance: {
        ...counts(advance),
        advanceAmount: this.num(advance?.advanceAmount),
        paidAmount: this.num(advance?.paidAmount),
        unadjustedAmount: this.num(advance?.unadjustedAmount),
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
      where.push(`${t}."${spec.dateColumn}"::date >= ${add(query.dateFrom)}::date`);
    }
    if (query.dateTo) {
      where.push(`${t}."${spec.dateColumn}"::date <= ${add(query.dateTo)}::date`);
    }

    return { where: where.join(' AND '), params };
  }

  private empty() {
    return {
      po: { ...ZERO_APPROVALS },
      jmc: { ...ZERO_APPROVALS, signedCopyMissing: 0 },
      report: { ...ZERO_APPROVALS },
      invoice: {
        ...ZERO_APPROVALS,
        taxableAmount: 0,
        gstAmount: 0,
        invoiceAmount: 0,
        settledAmount: 0,
        outstandingAmount: 0,
        gstHoldCount: 0,
      },
      bookPayment: {
        ...ZERO_APPROVALS,
        bookedAmount: 0,
        awaitingTransferCount: 0,
        awaitingTransferAmount: 0,
        holdAmount: 0,
      },
      advance: { ...ZERO_APPROVALS, advanceAmount: 0, paidAmount: 0, unadjustedAmount: 0 },
    };
  }

  private int(value: unknown): number {
    return parseInt(String(value ?? '0'), 10) || 0;
  }

  private num(value: unknown): number {
    return Math.round((parseFloat(String(value ?? '0')) || 0) * 100) / 100;
  }
}
