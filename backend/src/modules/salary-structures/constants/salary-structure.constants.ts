// ==================== Enums ====================
export enum IncrementType {
  INITIAL = 'INITIAL',
  ANNUAL = 'ANNUAL',
  PROMOTION = 'PROMOTION',
  CORRECTION = 'CORRECTION',
  OTHER = 'OTHER',
}

// ==================== Error Messages ====================
export const SALARY_STRUCTURE_ERRORS = {
  NOT_FOUND: 'Salary structure not found',
  USER_NOT_FOUND: 'User not found',
  EMPLOYEE_CANNOT_SPECIFY_USER_ID:
    'You cannot specify userId filter. Only your own records are accessible.',
  ALREADY_EXISTS: 'Active salary structure already exists for this user',
  EFFECTIVE_FROM_REQUIRED: 'Effective from date is required',
  EFFECTIVE_FROM_PAST: 'Effective from date cannot be in the past for increments',
  INVALID_SALARY_COMPONENTS: 'All salary components must be non-negative',
  OVERLAPPING_STRUCTURE: 'Overlapping salary structure exists for the given date range',
  CANNOT_EDIT_PAST_STRUCTURE: 'Cannot edit salary structure that has already been used in payroll',
  NO_ACTIVE_STRUCTURE: 'No active salary structure found for this user',
  ESIC_CONFIG_NOT_FOUND: 'ESIC gross limit configuration not found',
  ESIC_CONFIG_SETTING_NOT_FOUND: 'ESIC gross limit config setting not found',
  ESIC_NOT_APPLICABLE: 'ESIC is only applicable when gross salary is ≤ ₹{limit}',
};

// ==================== Success Messages ====================
export const SALARY_STRUCTURE_RESPONSES = {
  CREATED: 'Salary structure created successfully',
  UPDATED: 'Salary structure updated successfully',
  INCREMENT_APPLIED: 'Increment applied successfully',
  DEACTIVATED: 'Salary structure deactivated successfully',
  DELETED: 'Salary structure deleted successfully',
};

// ==================== Field Names ====================
export const SALARY_FIELD_NAMES = {
  SALARY_STRUCTURE: 'Salary Structure',
};

// ==================== Sort Field Mapping ====================
export const SALARY_STRUCTURE_SORT_FIELD_MAPPING: Record<string, string> = {
  basic: 'ss."basic"',
  grossSalary: 'ss."grossSalary"',
  netSalary: 'ss."netSalary"',
  ctc: 'ss."ctc"',
  effectiveFrom: 'ss."effectiveFrom"',
  createdAt: 'ss."createdAt"',
  updatedAt: 'ss."updatedAt"',
};
