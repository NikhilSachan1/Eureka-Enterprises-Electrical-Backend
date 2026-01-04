export const FNF_ERRORS = {
  FNF_NOT_FOUND: 'FNF settlement not found',
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_HAS_FNF: 'User already has an active FNF settlement',
  INVALID_EXIT_DATE: 'Exit date cannot be in the past',
  INVALID_LAST_WORKING_DATE: 'Last working date cannot be after exit date',
  NO_SALARY_STRUCTURE: 'No active salary structure found for user',
  CLEARANCE_PENDING: 'Cannot proceed - clearance pending for: {items}',
  INVALID_STATUS_TRANSITION: 'Invalid status transition from {current} to {target}',
  ALREADY_COMPLETED: 'FNF settlement is already completed',
  ALREADY_CANCELLED: 'FNF settlement is already cancelled',
  NOT_CALCULATED: 'FNF must be calculated before approval',
  NOT_APPROVED: 'FNF must be approved before generating documents',
  DOCUMENTS_NOT_GENERATED: 'Documents must be generated before completion',
  SETTINGS_NOT_CONFIGURED: 'FNF settings not configured',
  UPDATE_IN_INVALID_STATUS: 'FNF can only be updated for Pending Clearance or Calculated status',
  CLEARANCE_UPDATE_NOT_ALLOWED: 'Cannot update clearance for completed or cancelled FNF',
};

export const FNF_SUCCESS_MESSAGES = {
  FNF_INITIATED: 'FNF settlement initiated successfully',
  FNF_CALCULATED: 'FNF settlement calculated successfully',
  FNF_UPDATED: 'FNF settlement updated successfully',
  FNF_APPROVED: 'FNF settlement approved successfully',
  FNF_DOCUMENTS_GENERATED: 'FNF documents generated successfully',
  FNF_COMPLETED: 'FNF settlement completed successfully',
  FNF_CANCELLED: 'FNF settlement cancelled successfully',
  CLEARANCE_UPDATED: 'Clearance status updated successfully',
  DOCUMENTS_GENERATED: 'Documents generated successfully',
  DOCUMENTS_SENT: 'Documents sent successfully',
};

export const FNF_DTO_ERRORS = {
  INVALID_EXIT_REASON: 'Invalid exit reason. Please choose from the following: {exitReasons}',
  INVALID_CLEARANCE_STATUS:
    'Invalid clearance status. Please choose from the following: {clearanceStatuses}',
  INVALID_FNF_STATUS: 'Invalid FNF status. Please choose from the following: {fnfStatuses}',
};

export enum FnfStatus {
  INITIATED = 'INITIATED',
  CALCULATED = 'CALCULATED',
  PENDING_CLEARANCE = 'PENDING_CLEARANCE',
  APPROVED = 'APPROVED',
  DOCUMENTS_GENERATED = 'DOCUMENTS_GENERATED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ExitReason {
  RESIGNATION = 'RESIGNATION',
  TERMINATION = 'TERMINATION',
  RETIREMENT = 'RETIREMENT',
  CONTRACT_END = 'CONTRACT_END',
  ABSCONDING = 'ABSCONDING',
  MUTUAL_SEPARATION = 'MUTUAL_SEPARATION',
  MEDICAL = 'MEDICAL',
  DEATH = 'DEATH',
}

export enum ClearanceStatus {
  PENDING = 'PENDING',
  CLEARED = 'CLEARED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export const VALID_STATUS_TRANSITIONS: Record<FnfStatus, FnfStatus[]> = {
  [FnfStatus.INITIATED]: [FnfStatus.CALCULATED, FnfStatus.CANCELLED],
  [FnfStatus.CALCULATED]: [FnfStatus.PENDING_CLEARANCE, FnfStatus.APPROVED, FnfStatus.CANCELLED],
  [FnfStatus.PENDING_CLEARANCE]: [FnfStatus.APPROVED, FnfStatus.CANCELLED],
  [FnfStatus.APPROVED]: [FnfStatus.DOCUMENTS_GENERATED, FnfStatus.CANCELLED],
  [FnfStatus.DOCUMENTS_GENERATED]: [FnfStatus.COMPLETED, FnfStatus.CANCELLED],
  [FnfStatus.COMPLETED]: [],
  [FnfStatus.CANCELLED]: [],
};

export enum FnfSortFields {
  CREATED_AT = 'createdAt',
  EXIT_DATE = 'exitDate',
  LAST_WORKING_DATE = 'lastWorkingDate',
  NET_PAYABLE = 'netPayable',
  STATUS = 'status',
}

export const FNF_EXPENSE_CATEGORIES = {
  LEAVE_ENCASHMENT: 'LEAVE_ENCASHMENT',
  FNF_SETTLEMENT: 'FNF_SETTLEMENT',
  FNF_GRATUITY: 'FNF_GRATUITY',
} as const;

export const FNF_EXPENSE_DESCRIPTIONS = {
  LEAVE_ENCASHMENT: 'Leave Encashment - {days} days @ ₹{dailySalary}/day (FNF)',
} as const;

export const FNF_EXPENSE_REFERENCE_TYPES = {
  LEAVE_ENCASHMENT: 'FNF_LEAVE_ENCASHMENT',
  SETTLEMENT: 'FNF_SETTLEMENT',
  GRATUITY: 'FNF_GRATUITY',
} as const;
