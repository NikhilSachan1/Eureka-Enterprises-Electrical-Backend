import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  FinancialApprovalStatus,
  PartyType,
} from 'src/modules/common/financials/financial.constants';
import { resolveReadableSiteFilter } from 'src/modules/common/financials/site-access.helper';
import { DefaultPaginationValues } from 'src/utils/utility/constants/utility.constants';
import { GetInvoiceLedgerDto } from './dto/get-invoice-ledger.dto';
import {
  LEDGER_AMOUNT_FIELDS as AMOUNT_FIELDS,
  LEDGER_PDF_MAX_ROWS,
  LEDGER_PDF_MESSAGES,
  LEDGER_SORT_COLUMNS,
} from './constants/invoice-ledger.constants';
import { InvoiceLedgerPdfService } from './invoice-ledger-pdf.service';
import { LedgerPdfRow } from './types/invoice-ledger-pdf.types';
import {
  invoiceLedgerPageQuery,
  invoiceLedgerSummaryQuery,
} from './queries/invoice-ledger.queries';
import { roundInr } from 'src/modules/common/financials/amount-format.helper';

/** pg returns NUMERIC as a string; the API sends numbers rounded to paise. */
const toAmount = (value: unknown): number => roundInr(Number(value ?? 0) || 0);

/**
 * Invoice ledger for one side: contractor (SALE) or vendor (PURCHASE). Each row is an invoice with
 * its tax split, TDS, what has been paid against it (with the transfer dates) and what is still
 * outstanding — the shape of a CA reconciliation statement. Totals cover every matching row.
 */
@Injectable()
export class InvoiceLedgerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pdfService: InvoiceLedgerPdfService,
  ) {}

  /** `partyType` comes from the route (contractor / vendor ledger), never from the query. */
  async getLedger(
    query: GetInvoiceLedgerDto,
    partyType: PartyType,
    userId: string,
    activeRole?: string,
  ) {
    const { page = DefaultPaginationValues.PAGE, pageSize = DefaultPaginationValues.PAGE_SIZE } =
      query;

    const siteIds = await resolveReadableSiteFilter(
      this.dataSource,
      userId,
      activeRole,
      query.siteId,
    );
    if (siteIds?.length === 0) {
      return {
        records: [],
        totalRecords: 0,
        totals: this.mapTotals(undefined),
        insights: {
          byMonth: [],
          topParties: [],
          statusMix: [],
          ageing: [],
          oldestOutstandingDays: null,
        },
      };
    }

    const { rows, summary } = await this.runLedgerQueries(
      query,
      partyType,
      siteIds,
      pageSize,
      (page - 1) * pageSize,
    );
    const totals = summary?.totals as Record<string, unknown> | undefined;

    return {
      records: rows.map((row: Record<string, unknown>) => this.mapRow(row)),
      totalRecords: Number(totals?.totalRecords ?? 0),
      totals: this.mapTotals(totals),
      insights: {
        byMonth: (summary?.byMonth ?? []).map((m: Record<string, unknown>) => ({
          month: m.month as string,
          billed: toAmount(m.billed),
          outstanding: toAmount(m.outstanding),
        })),
        topParties: (summary?.topParties ?? []).map((p: Record<string, unknown>) => ({
          partyName: p.partyName as string,
          count: Number(p.count),
          outstanding: toAmount(p.outstanding),
        })),
        statusMix: (summary?.statusMix ?? []).map((s: Record<string, unknown>) => ({
          status: s.status as string,
          count: Number(s.count),
          outstanding: toAmount(s.outstanding),
        })),
        ageing: (summary?.ageing ?? []).map((a: Record<string, unknown>) => ({
          bucket: a.bucket as string,
          count: Number(a.count),
          outstanding: toAmount(a.outstanding),
        })),
        oldestOutstandingDays:
          summary?.oldestOutstandingDays === null || summary?.oldestOutstandingDays === undefined
            ? null
            : Number(summary.oldestOutstandingDays),
      },
    };
  }

  /**
   * The ledger as a PDF: every invoice matching the same filters as the page (no paging), with
   * the totals. Returns a download URL like the payment sheet PDF does.
   */
  async getLedgerPdf(
    query: GetInvoiceLedgerDto,
    partyType: PartyType,
    userId: string,
    activeRole?: string,
  ) {
    const siteIds = await resolveReadableSiteFilter(
      this.dataSource,
      userId,
      activeRole,
      query.siteId,
    );
    if (siteIds?.length === 0) throw new BadRequestException(LEDGER_PDF_MESSAGES.NO_ROWS);

    // One row past the cap tells "too many" apart from "exactly the cap".
    const { rows, summary } = await this.runLedgerQueries(
      query,
      partyType,
      siteIds,
      LEDGER_PDF_MAX_ROWS + 1,
      0,
    );
    if (!rows.length) throw new BadRequestException(LEDGER_PDF_MESSAGES.NO_ROWS);
    if (rows.length > LEDGER_PDF_MAX_ROWS) {
      throw new BadRequestException(LEDGER_PDF_MESSAGES.TOO_MANY_ROWS);
    }

    return await this.pdfService.generate({
      partyType,
      rows: rows.map((row: Record<string, unknown>) => this.mapRow(row)) as LedgerPdfRow[],
      totals: this.mapTotals(summary?.totals),
      generatedAt: new Date(),
    });
  }

  /** One page of ledger rows (in the requested order) and the summary over every matching row. */
  private async runLedgerQueries(
    query: GetInvoiceLedgerDto,
    partyType: PartyType,
    siteIds: string[] | null,
    limitRows: number,
    offsetRows: number,
  ) {
    const params: unknown[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    const where = this.buildInvoiceWhere(query, partyType, siteIds, bind);
    const ledgerWhere = this.buildLedgerWhere(query, bind);
    // Replacer functions, so `$n` placeholders are never read as replacement patterns.
    const fill = (sql: string) =>
      sql.replace('{where}', () => where).replace('{ledgerWhere}', () => ledgerWhere);

    const summaryParams = [...params];
    const orderBy = this.buildOrderBy(query);
    const limit = bind(limitRows);
    const offset = bind(offsetRows);
    const pageSql = fill(invoiceLedgerPageQuery)
      .replace('{orderBy}', () => orderBy)
      .replace('{limit}', () => limit)
      .replace('{offset}', () => offset);

    // Two statements: the rows, and everything above the table (built from one filtered ledger).
    const [rows, [summary]] = await Promise.all([
      this.dataSource.query(pageSql, params),
      this.dataSource.query(fill(invoiceLedgerSummaryQuery), summaryParams),
    ]);
    return { rows, summary };
  }

  private buildInvoiceWhere(
    query: GetInvoiceLedgerDto,
    partyType: PartyType,
    siteIds: string[] | null,
    bind: (value: unknown) => string,
  ): string {
    const conditions = ['i."deletedAt" IS NULL', `i."partyType" = ${bind(partyType)}`];

    if (siteIds) conditions.push(`i."siteId" = ANY(${bind(siteIds)}::uuid[])`);
    if (query.companyId?.length)
      conditions.push(`s."companyId" = ANY(${bind(query.companyId)}::uuid[])`);

    // A contractor filter only means something on the SALE side, a vendor filter on PURCHASE.
    if (partyType === PartyType.SALE && query.contractorId?.length) {
      conditions.push(`i."contractorId" = ANY(${bind(query.contractorId)}::uuid[])`);
    }
    if (partyType === PartyType.PURCHASE && query.vendorId?.length) {
      conditions.push(`i."vendorId" = ANY(${bind(query.vendorId)}::uuid[])`);
    }

    // A rejected invoice was never billed; it has no place in the ledger.
    conditions.push(`i."approvalStatus" <> ${bind(FinancialApprovalStatus.REJECTED)}`);

    if (query.financialYear) {
      const startYear = Number(query.financialYear.slice(0, 4));
      conditions.push(`i."invoiceDate" >= ${bind(`${startYear}-04-01`)}::date`);
      conditions.push(`i."invoiceDate" <= ${bind(`${startYear + 1}-03-31`)}::date`);
    }
    if (query.dateFrom) conditions.push(`i."invoiceDate" >= ${bind(query.dateFrom)}::date`);
    if (query.dateTo) conditions.push(`i."invoiceDate" <= ${bind(query.dateTo)}::date`);

    const search = query.search?.trim();
    if (search) {
      const pattern = bind(`%${search}%`);
      conditions.push(`(i."invoiceNumber" ILIKE ${pattern} OR po."poNumber" ILIKE ${pattern})`);
    }

    return conditions.join(' AND ');
  }

  private buildLedgerWhere(query: GetInvoiceLedgerDto, bind: (value: unknown) => string): string {
    const conditions = ['TRUE'];
    if (query.quarter?.length) conditions.push(`"quarter" = ANY(${bind(query.quarter)}::text[])`);
    if (query.paymentStatus?.length) {
      conditions.push(`"paymentStatus" = ANY(${bind(query.paymentStatus)}::text[])`);
    }
    return conditions.join(' AND ');
  }

  private buildOrderBy(query: GetInvoiceLedgerDto): string {
    const column = query.sortField ? LEDGER_SORT_COLUMNS[query.sortField] : undefined;
    if (!column) {
      // A ledger reads oldest first.
      return '"invoiceDate" ASC NULLS LAST, "createdAt" ASC';
    }
    const direction = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    return `${column} ${direction} NULLS LAST, "createdAt" ASC`;
  }

  private mapRow(row: Record<string, unknown>) {
    const amounts = Object.fromEntries(AMOUNT_FIELDS.map((key) => [key, toAmount(row[key])]));
    const payments = Array.isArray(row.payments) ? row.payments : [];
    return {
      ...row,
      ...amounts,
      gstPercentage: row.gstPercentage === null ? null : Number(row.gstPercentage),
      tdsPercentage: row.tdsPercentage === null ? null : Number(row.tdsPercentage),
      payments: payments.map((p: { date: string; amount: unknown }) => ({
        date: p.date,
        amount: toAmount(p.amount),
      })),
    };
  }

  private mapTotals(row: Record<string, unknown> | undefined): Record<string, number> {
    return Object.fromEntries(AMOUNT_FIELDS.map((key) => [key, toAmount(row?.[key])]));
  }
}
