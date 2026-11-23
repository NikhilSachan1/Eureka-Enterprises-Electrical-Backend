import { Injectable } from '@nestjs/common';
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
  LEDGER_SORT_COLUMNS,
} from './constants/invoice-ledger.constants';
import { invoiceLedgerPageQuery, invoiceLedgerTotalsQuery } from './queries/invoice-ledger.queries';
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
  constructor(private readonly dataSource: DataSource) {}

  async getLedger(query: GetInvoiceLedgerDto, userId: string, activeRole?: string) {
    const { page = DefaultPaginationValues.PAGE, pageSize = DefaultPaginationValues.PAGE_SIZE } =
      query;

    const siteIds = await resolveReadableSiteFilter(
      this.dataSource,
      userId,
      activeRole,
      query.siteId,
    );
    if (siteIds?.length === 0) {
      return { records: [], totalRecords: 0, totals: this.emptyTotals() };
    }

    const params: unknown[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    const where = this.buildInvoiceWhere(query, siteIds, bind);
    const ledgerWhere = this.buildLedgerWhere(query, bind);
    // Replacer functions, so `$n` placeholders are never read as replacement patterns.
    const fill = (sql: string) =>
      sql.replace('{where}', () => where).replace('{ledgerWhere}', () => ledgerWhere);

    const totalsParams = [...params];
    const orderBy = this.buildOrderBy(query);
    const limit = bind(pageSize);
    const offset = bind((page - 1) * pageSize);
    const pageSql = fill(invoiceLedgerPageQuery)
      .replace('{orderBy}', () => orderBy)
      .replace('{limit}', () => limit)
      .replace('{offset}', () => offset);

    const [rows, [totalsRow]] = await Promise.all([
      this.dataSource.query(pageSql, params),
      this.dataSource.query(fill(invoiceLedgerTotalsQuery), totalsParams),
    ]);

    return {
      records: rows.map((row: Record<string, unknown>) => this.mapRow(row)),
      totalRecords: Number(totalsRow?.totalRecords ?? 0),
      totals: this.mapTotals(totalsRow),
    };
  }

  private buildInvoiceWhere(
    query: GetInvoiceLedgerDto,
    siteIds: string[] | null,
    bind: (value: unknown) => string,
  ): string {
    const conditions = ['i."deletedAt" IS NULL', `i."partyType" = ${bind(query.partyType)}`];

    if (siteIds) conditions.push(`i."siteId" = ANY(${bind(siteIds)}::uuid[])`);
    if (query.companyId?.length)
      conditions.push(`s."companyId" = ANY(${bind(query.companyId)}::uuid[])`);

    // A contractor filter only means something on the SALE side, a vendor filter on PURCHASE.
    if (query.partyType === PartyType.SALE && query.contractorId?.length) {
      conditions.push(`i."contractorId" = ANY(${bind(query.contractorId)}::uuid[])`);
    }
    if (query.partyType === PartyType.PURCHASE && query.vendorId?.length) {
      conditions.push(`i."vendorId" = ANY(${bind(query.vendorId)}::uuid[])`);
    }

    if (query.approvalStatus?.length) {
      conditions.push(`i."approvalStatus" = ANY(${bind(query.approvalStatus)}::text[])`);
    } else {
      conditions.push(`i."approvalStatus" <> ${bind(FinancialApprovalStatus.REJECTED)}`);
    }

    if (query.financialYear) {
      const startYear = Number(query.financialYear.slice(0, 4));
      conditions.push(`i."invoiceDate" >= ${bind(`${startYear}-04-01`)}::date`);
      conditions.push(`i."invoiceDate" <= ${bind(`${startYear + 1}-03-31`)}::date`);
    }
    if (query.dateFrom) conditions.push(`i."invoiceDate" >= ${bind(query.dateFrom)}::date`);
    if (query.dateTo) conditions.push(`i."invoiceDate" <= ${bind(query.dateTo)}::date`);

    const search = query.search?.trim();
    if (search) {
      const term = bind(`%${search}%`);
      conditions.push(
        `(i."invoiceNumber" ILIKE ${term} OR po."poNumber" ILIKE ${term} OR j."jmcNumber" ILIKE ${term})`,
      );
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
      payments: payments.map((p: { date: string; amount: unknown; utrNumber: string }) => ({
        date: p.date,
        amount: toAmount(p.amount),
        utrNumber: p.utrNumber,
      })),
    };
  }

  private mapTotals(row: Record<string, unknown> | undefined) {
    return Object.fromEntries(AMOUNT_FIELDS.map((key) => [key, toAmount(row?.[key])]));
  }

  private emptyTotals() {
    return this.mapTotals(undefined);
  }
}
