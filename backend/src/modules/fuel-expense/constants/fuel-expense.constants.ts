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
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMode {
  CARD = 'CARD',
  CASH = 'CASH',
  UPI = 'UPI',
  CREDIT = 'CREDIT',
}

export enum FuelExpenseEntityFields {
  ID = 'id',
  FUEL_EXPENSE = 'Fuel expense',
}

export const FUEL_EXPENSE_ERRORS = {
  FUEL_EXPENSE_NOT_FOUND: 'Fuel expense not found',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  CARD_NOT_FOUND: 'Card not found',
  USER_NOT_FOUND: 'User not found',
  INVALID_FILL_DATE: 'Fill date cannot be in the future',
  INVALID_ODOMETER_READING: 'Odometer reading must be greater than previous reading',
  INVALID_FUEL_AMOUNT: 'Fuel amount must be greater than zero',
  INVALID_FUEL_LITERS: 'Fuel liters must be greater than zero',
  FUEL_EXPENSE_ALREADY_APPROVED: 'Fuel expense is already approved',
  FUEL_EXPENSE_ALREADY_REJECTED: 'Fuel expense is already rejected',
  FUEL_EXPENSE_CANNOT_BE_APPROVED_BY_CREATOR: 'Fuel expense cannot be approved by the creator',
  APPROVAL_REASON_REQUIRED: 'Approval reason is required when rejecting',
  INVALID_APPROVAL_STATUS: 'Invalid approval status',
  PAYMENT_MODE_NOT_FOUND: 'Payment mode not found. Available modes: {paymentModes}',
  INSUFFICIENT_DATA_FOR_AVERAGE: 'Insufficient fuel expense data to calculate vehicle average',
  FUEL_EXPENSE_CANNOT_BE_EDITED: 'Fuel expense cannot be edited as it is not pending for approval',
  FUEL_EXPENSE_CANNOT_BE_EDITED_BY_OTHER_USER:
    'Fuel expense cannot be edited by other user, only the creator can edit the fuel expense',
  FUEL_EXPENSE_DATE_TOO_OLD:
    'Fuel expense date is too old. You can only add fuel expenses for the past {days} days',
  INSUFFICIENT_DATA_TO_CALCULATE_AVERAGE: 'Insufficient data to calculate vehicle average',
  EMPLOYEE_CANNOT_SPECIFY_USER_IDS: 'Employee cannot specify user IDs',
  FUEL_EXPENSE_STATUS_SWITCH_ERROR:
    'Fuel expense is already in {status} state, cannot be processed. Reach out to the manager, admin or HR for assistance',
  FUEL_EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR: 'Fuel expense cannot be rejected by the creator',
  COULD_NOT_CALCULATE_VEHICLE_AVERAGE: 'Could not calculate vehicle average: {error}',
  FUEL_EXPENSE_CANNOT_DELETE_OTHERS: 'You can only delete your own fuel expenses',
  FUEL_EXPENSE_CANNOT_DELETE_NON_PENDING:
    'Only pending fuel expenses can be deleted. This fuel expense is already {status}',
  FUEL_EXPENSE_ALREADY_DELETED: 'Fuel expense is already deleted',
};

export const FUEL_EXPENSE_SUCCESS_MESSAGES = {
  FUEL_EXPENSE_CREATED: 'Fuel expense added successfully',
  FUEL_EXPENSE_FORCE_CREATED: 'Fuel expense forced successfully',
  FUEL_EXPENSE_CREDIT_SETTLED: 'Fuel expense credit settled successfully',
  FUEL_EXPENSE_UPDATED: 'Fuel expense updated successfully',
  FUEL_EXPENSE_DELETED: 'Fuel expense deleted successfully',
  FUEL_EXPENSE_APPROVED: 'Fuel expense approved successfully',
  FUEL_EXPENSE_REJECTED: 'Fuel expense rejected successfully',
  BULK_APPROVAL_SUCCESS:
    'Bulk approval processed: {length} total, {success} successful, {error} failed',
  BULK_DELETE_SUCCESS:
    'Bulk delete processed: {length} total, {success} successful, {error} failed',
};

export const DEFAULT_FUEL_EXPENSE = {
  EDIT_REASON: 'Fuel expense updated',
  FORCE_APPROVAL_REASON: 'Force fuel expense',
  CREDIT_APPROVAL_REASON: 'Paid Successfully',
};

export enum FuelExpenseSortableFields {
  FILL_DATE = 'fillDate',
  ODOMETER_KM = 'odometerKm',
  FUEL_LITERS = 'fuelLiters',
  FUEL_AMOUNT = 'fuelAmount',
  APPROVAL_STATUS = 'approvalStatus',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}
