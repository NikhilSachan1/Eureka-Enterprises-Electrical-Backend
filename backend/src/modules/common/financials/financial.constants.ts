/**
 * Shared financial-module enums used across PO, JMC, Report, Invoice,
 * Book Payment, Bank Transfer, Payment Advice, Debit/Credit Notes,
 * GST, and TDS modules.
 *
 * BRD reference: backend/docs/new-contractor-vendor-req-doc.md
 */

export enum PartyType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
}

export enum FinancialApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum NoteSide {
  SALE = 'SALE', // debit notes
  PURCHASE = 'PURCHASE', // credit notes
}

export enum GstType {
  GST_1 = 'GST-1', // sale, output tax
  GST_3B = 'GST-3B', // purchase, input tax
}

export const FINANCIAL_ERRORS = {
  PARTY_INVALID:
    'partyType must be SALE (with contractorId) or PURCHASE (with vendorId), exactly one set.',
  PARENT_NOT_APPROVED:
    'Parent document must be approved before this child can be created.',
  PARENT_NOT_FOUND: 'Parent document not found.',
  PO_CEILING_EXCEEDED:
    'PO ceiling exceeded — sum of invoiced amount cannot exceed PO total amount.',
  INVOICE_CEILING_EXCEEDED:
    'Invoice ceiling exceeded — sum of payments cannot exceed invoice total amount.',
  BOOK_PAYMENT_AMOUNT_MISMATCH:
    'Bank transfer amount must equal the book payment amount exactly.',
  ALREADY_APPROVED: 'Document is already approved.',
  ALREADY_REJECTED: 'Document is already rejected.',
  CANNOT_EDIT_LOCKED:
    'Document is locked. Request unlock from admin to make changes.',
  CANNOT_DELETE_HAS_CHILDREN:
    'Cannot delete document — child documents exist. Delete children first.',
  CANNOT_DELETE_NOT_PENDING:
    'Document can only be deleted while in PENDING state.',
  UNLOCK_NOT_REQUESTED: 'No unlock request pending on this document.',
  AMOUNT_VALIDATION_FAILED:
    'Total amount must equal taxable amount + GST amount.',
};

/**
 * Convert a JS Date / ISO date to the financial-year string used in
 * Payment Advice references and partition naming.
 *
 * Indian FY runs April 1 → March 31. FY 2025-26 → "2526".
 */
export function getFinancialYear(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1..12
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}
