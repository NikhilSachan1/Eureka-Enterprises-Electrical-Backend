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
  NOT_FOUND: 'Expense not found',
  EXPENSE_CANNOT_BE_EDITED: 'Expense cannot be edited as it is not pending for approval',
  EXPENSE_CANNOT_BE_EDITED_BY_OTHER_USER:
    'Expense cannot be edited by other user, only the creator can edit the expense',
  EMPLOYEE_CANNOT_SPECIFY_USER_IDS:
    'Employee cannot specify user ids, only the employee can view their own expenses',
  AMOUNT_MUST_BE_GREATER_THAN_ZERO: 'Amount must be greater than 0',
};

export const DEFAULT_EXPENSE = {
  FORCE_APPROVAL_REASON: 'Force expense',
  CREDIT_APPROVAL_REASON: 'Paid Successfully',
  EDIT_REASON: 'Expense updated',
};

export enum ExpenseTrackerEntityFields {
  ID = 'id',
  EXPENSE = 'Expense',
}
