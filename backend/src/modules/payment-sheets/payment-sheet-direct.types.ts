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
  /** Vendor only: the book payment settled and the bank transfer that settled it. */
  bookPaymentId?: string;
  bankTransferId?: string;
}

export interface DirectSheetResult {
  id: string;
  sheetNumber: string;
}
