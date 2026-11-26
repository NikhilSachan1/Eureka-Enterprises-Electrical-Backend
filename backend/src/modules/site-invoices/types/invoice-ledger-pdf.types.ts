import { PartyType } from 'src/modules/common/financials/financial.constants';

/** One invoice row as the ledger page query returns it, amounts already numbers. */
export interface LedgerPdfRow {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  financialYear: string | null;
  quarter: string | null;
  isGstHold: boolean;
  gstPercentage: number | null;
  tdsPercentage: number | null;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  grossAmount: number;
  tdsAmount: number;
  advanceAdjusted: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: string;
  poNumber: string | null;
  siteName: string;
  siteCity: string | null;
  siteState: string | null;
  companyName: string | null;
  partyName: string | null;
  payments: { date: string; amount: number }[];
}

/** A built export, sent straight back to the browser. */
export interface LedgerDocumentFile {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}

/** Optional amount columns in the PDF table; one left out when it would be all zero. */
export interface LedgerPdfColumns {
  advance: boolean;
  cgstSgst: boolean;
  igst: boolean;
}

/** Everything the ledger PDF prints. */
export interface LedgerPdfData {
  partyType: PartyType;
  rows: LedgerPdfRow[];
  totals: Record<string, number>;
  generatedAt: Date;
}
