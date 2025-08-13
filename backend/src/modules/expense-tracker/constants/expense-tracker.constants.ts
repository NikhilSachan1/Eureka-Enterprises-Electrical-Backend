export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  CREDIT_CARD = 'credit_card',
}

export enum ExpenseEntryType {
  SELF = 'self',
  FORCED = 'forced',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const EXPENSE_TRACKER_ERRORS = {
  EXPENSE_CATEGORY_NOT_FOUND:
    'Expense category not found. Available categories: {expenseCategories}',
  PAYMENT_MODE_NOT_FOUND: 'Payment mode not found. Available modes: {paymentModes}',
  INVALID_EXPENSE_DATE: 'Expense date cannot be in the future',
  EXPENSE_DATE_TOO_OLD:
    'Expense date is too old. You can only add expenses for the past {days} days',
};

export const DEFAULT_EXPENSE = {
  FORCE_APPROVAL_REASON: 'Force expense',
  CREDIT_APPROVAL_REASON: 'Paid Successfully',
};
