import { CreateCreditExpenseDto } from 'src/modules/expense-tracker/dto';
import { CreateCreditFuelExpenseDto } from 'src/modules/fuel-expense/dto';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { BeneficiaryType, PaymentSourceType } from './constants/payment-sheet.constants';
import { BankSnapshot } from './entities/payment-sheet-item.entity';

/** Upload + request context the controller adds to a direct reimbursement body. */
export interface DirectReimburseContext {
  fileKeys: string[];
  sourceType: EntrySourceType;
  timezone?: string;
}

export type DirectExpenseReimburseInput = CreateCreditExpenseDto & DirectReimburseContext;

export type DirectFuelReimburseInput = CreateCreditFuelExpenseDto & DirectReimburseContext;

/** One already-settled payment, written as a COMPLETED one-line sheet. */
export interface DirectSheetRecord {
  sourceType:
    | PaymentSourceType.EXPENSE
    | PaymentSourceType.FUEL_EXPENSE
    | PaymentSourceType.VENDOR_PAYMENT;
  beneficiaryType: BeneficiaryType.USER | BeneficiaryType.VENDOR;
  userId: string | null;
  vendorId: string | null;
  amount: number;
  /** Beneficiary's pending just before this payment (advance when <= 0). */
  pendingSnapshot: number;
  bankSnapshot: BankSnapshot | null;
  paidFromAccountId: string | null;
  utrNumber: string | null;
  remarks: string | null;
  /** Vendor only: the book payment being settled. */
  bookPaymentId?: string;
}

export interface DirectSheetResult {
  id: string;
  sheetNumber: string;
}

/** The sheet reserved before settling, so its number can go on the ledger entry. */
export interface DirectSheetDraft extends DirectSheetResult {
  itemId: string;
  allocationId: string | null;
}

/** What the source module returned when it settled the payment. */
export interface DirectSettlement {
  /** Vendor only: the bank transfer created for the book payment. */
  bankTransferId?: string;
  /** Source module's own response, passed through to the caller (e.g. payment advice ids). */
  response?: Record<string, unknown>;
}
