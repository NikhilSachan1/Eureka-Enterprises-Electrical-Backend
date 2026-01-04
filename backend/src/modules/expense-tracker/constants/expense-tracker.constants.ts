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
  CANCELLED = 'cancelled',
}

export const EXPENSE_TRACKER_ERRORS = {
  EXPENSE_CATEGORY_NOT_FOUND:
    'Expense category not found. Available categories: {expenseCategories}',
  EXPENSE_CATEGORY_NOT_ALLOWED: 'You are not authorized to use this expense category',
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
  EXPENSE_STATUS_SWITCH_ERROR:
    'Expense is already in {status} state, cannot be processed. Reach out to the manager, admin or HR for assistance',
  EXPENSE_CANNOT_BE_APPROVED_BY_CREATOR:
    'Expense cannot be approved by the creator, only the manager, admin or HR can approve',
  EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR:
    'Expense cannot be rejected by the creator, only the manager, admin or HR can reject',
  EXPENSE_CANNOT_DELETE_OTHERS: 'You can only delete your own expenses',
  EXPENSE_CANNOT_DELETE_NON_PENDING:
    'Only pending expenses can be deleted. This expense is already {status}',
  EXPENSE_ALREADY_DELETED: 'Expense is already deleted',
};

export const EXPENSE_TRACKER_SUCCESS_MESSAGES = {
  EXPENSE_CREATED: 'Expense added successfully',
  EXPENSE_FORCE_CREATED: 'Expense forced successfully',
  CREDIT_SETTLED: 'Credit settled successfully',
  EXPENSE_APPROVAL_PROCESSED:
    'Expense approval processed successfully. {success} out of {length} expenses approved, {error} errors occurred',
  EXPENSE_APPROVAL_SUCCESS: 'Expense approval processed successfully for {status}',
  EXPENSE_DELETE_PROCESSED:
    'Bulk delete processed. {success} out of {length} expenses deleted, {error} errors occurred',
  EXPENSE_DELETE_SUCCESS: 'Expense deleted successfully',
};

export const EXPENSE_EMAIL_CONSTANTS = {
  SYSTEM_USER: 'System',
  NOT_APPLICABLE: 'N/A',
};

export const DEFAULT_EXPENSE = {
  FORCE_APPROVAL_REASON: 'Force expense',
  CREDIT_APPROVAL_REASON: 'Paid Successfully',
  EDIT_REASON: 'Expense updated',
};

export const SYSTEM_EXPENSE_DEFAULTS = {
  PAYMENT_MODE: 'BANK_TRANSFER',
  APPROVAL_REASON_PREFIX: 'System generated',
  DEFAULT_REFERENCE_TYPE: 'SYSTEM',
} as const;

export enum ExpenseTrackerEntityFields {
  ID = 'id',
  EXPENSE = 'Expense',
}

export enum ExpenseTrackerSortableFields {
  EXPENSE_DATE = 'expenseDate',
  AMOUNT = 'amount',
  CATEGORY = 'category',
  DESCRIPTION = 'description',
  APPROVAL_STATUS = 'approvalStatus',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  USER_NAME = 'userName',
}

// Mapping of sort fields to SQL expressions
export const EXPENSE_SORT_FIELD_MAPPING: Record<string, string> = {
  expenseDate: 'e."expenseDate"',
  amount: 'e."amount"',
  category: 'e."category"',
  description: 'e."description"',
  approvalStatus: 'e."approvalStatus"',
  createdAt: 'e."createdAt"',
  updatedAt: 'e."updatedAt"',
  userName: 'LOWER(CONCAT(u."firstName", \' \', u."lastName"))',
};
