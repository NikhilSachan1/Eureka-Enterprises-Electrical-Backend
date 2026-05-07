import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BILLING_QUERIES } from './queries/billing.queries';
import { BILLING_ERRORS, CLOSING_CONDITION_IDS, CLOSING_CONDITION_DETAILS } from './constants/billing.constants';
import {
  GetPoSummaryDto,
  GetSiteSummaryDto,
  GetSiteClosingReadinessDto,
} from './dto';
import { ClosingCondition, ClosingReadiness } from './billing.types';

@Injectable()
export class BillingService {
  constructor(private readonly dataSource: DataSource) {}

  async getPoSummary(dto: GetPoSummaryDto) {
    const result = await this.dataSource.query(BILLING_QUERIES.PO_SUMMARY, [dto.poId]);
    if (!result || result.length === 0) {
      throw new NotFoundException(BILLING_ERRORS.PO_NOT_FOUND);
    }
    return result[0];
  }

  async getSiteSummary(dto: GetSiteSummaryDto) {
    const rows = await this.dataSource.query(BILLING_QUERIES.SITE_SUMMARY, [dto.siteId]);

    if (dto.partyType) {
      return rows.filter((r: any) => r.partyType === dto.partyType);
    }
    return {
      siteId: dto.siteId,
      summaryByPartyType: rows,
    };
  }

  async getSiteClosingReadiness(dto: GetSiteClosingReadinessDto): Promise<ClosingReadiness> {
    const conditions: ClosingCondition[] = [];

    // Condition 1: Every party has at least one approved PO
    const partiesCheck = await this.dataSource.query(BILLING_QUERIES.PARTIES_WITH_PO, [dto.siteId]);
    const allPartiesHavePO = partiesCheck[0]?.allPartiesHavePO ?? true;
    conditions.push({
      id: CLOSING_CONDITION_IDS.EVERY_PARTY_HAS_APPROVED_PO,
      pass: allPartiesHavePO,
      detail: allPartiesHavePO ? [] : [CLOSING_CONDITION_DETAILS.PARTIES_WITHOUT_PO],
    });

    // Condition 2: No invoice exceeds its PO total
    const invoiceOverPo = await this.dataSource.query(BILLING_QUERIES.INVOICE_OVER_PO, [dto.siteId]);
    conditions.push({
      id: CLOSING_CONDITION_IDS.INVOICE_NOT_EXCEEDING_PO,
      pass: invoiceOverPo.length === 0,
      detail: invoiceOverPo.map((r: any) =>
        CLOSING_CONDITION_DETAILS.PO_INVOICED_OVER_TOTAL(r.poNumber, r.invoicedTotal, r.poTotal),
      ),
    });

    // Condition 3: Sale invoices fully paid
    const saleUnpaid = await this.dataSource.query(BILLING_QUERIES.UNPAID_SALE_INVOICES, [dto.siteId]);
    conditions.push({
      id: CLOSING_CONDITION_IDS.SALE_FULLY_PAID,
      pass: saleUnpaid.length === 0,
      detail: saleUnpaid.map((r: any) =>
        CLOSING_CONDITION_DETAILS.INVOICE_UNPAID(r.invoiceNumber, r.unpaid),
      ),
    });

    // Condition 4: Purchase invoices fully paid
    const purchaseUnpaid = await this.dataSource.query(BILLING_QUERIES.UNPAID_PURCHASE_INVOICES, [dto.siteId]);
    conditions.push({
      id: CLOSING_CONDITION_IDS.PURCHASE_FULLY_PAID,
      pass: purchaseUnpaid.length === 0,
      detail: purchaseUnpaid.map((r: any) =>
        CLOSING_CONDITION_DETAILS.INVOICE_UNPAID(r.invoiceNumber, r.unpaid),
      ),
    });

    // Condition 5: No pending or rejected documents
    const pendingRejected = await this.dataSource.query(BILLING_QUERIES.PENDING_OR_REJECTED_DOCS, [dto.siteId]);
    conditions.push({
      id: CLOSING_CONDITION_IDS.NO_PENDING_OR_REJECTED_DOCS,
      pass: pendingRejected.length === 0,
      detail: pendingRejected.map((r: any) => `${r.docType} ${r.number} is pending or rejected`),
    });

    // Condition 6: GST/TDS settled
    const gstTdsStatus = await this.dataSource.query(BILLING_QUERIES.UNVERIFIED_GST_TDS, [dto.siteId]);
    const gstTdsDetail: string[] = [];
    for (const row of gstTdsStatus) {
      if (Number(row.count) > 0) {
        gstTdsDetail.push(CLOSING_CONDITION_DETAILS.GST_TDS_ENTRIES(row.type, row.count));
      }
    }
    conditions.push({
      id: CLOSING_CONDITION_IDS.GST_TDS_SETTLED,
      pass: gstTdsDetail.length === 0,
      detail: gstTdsDetail,
    });

    const canClose = conditions.every((c) => c.pass);

    return { canClose, conditions };
  }
}
