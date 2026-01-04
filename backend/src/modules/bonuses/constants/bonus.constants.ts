// ==================== Enums ====================
export enum BonusType {
  DIWALI = 'DIWALI',
  BIRTHDAY = 'BIRTHDAY',
  PERFORMANCE = 'PERFORMANCE',
  JOINING = 'JOINING',
  REFERRAL = 'REFERRAL',
  ANNUAL = 'ANNUAL',
  FESTIVAL = 'FESTIVAL',
  OTHER = 'OTHER',
}

export enum BonusStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// ==================== Error Messages ====================
export const BONUS_ERRORS = {
  NOT_FOUND: 'Bonus not found',
  USER_NOT_FOUND: 'User not found',
  EMPLOYEE_CANNOT_SPECIFY_USER_ID:
    'You cannot specify userId filter. Only your own records are accessible.',
  INVALID_MONTH: 'Month must be between 1 and 12',
  INVALID_YEAR: 'Invalid year',
  ALREADY_PAID: 'Bonus has already been paid and cannot be modified',
  ALREADY_CANCELLED: 'Bonus has already been cancelled',
  INVALID_STATUS: 'Invalid bonus status',
};

// ==================== Success Messages ====================
export const BONUS_RESPONSES = {
  CREATED: 'Bonus created successfully',
  UPDATED: 'Bonus updated successfully',
  CANCELLED: 'Bonus cancelled successfully',
  MARKED_PAID: 'Bonus marked as paid',
  DELETED: 'Bonus deleted successfully',
};

// ==================== Field Names ====================
export const BONUS_FIELD_NAMES = {
  BONUS: 'Bonus',
};

// ==================== Sort Field Mapping ====================
export const BONUS_SORT_FIELD_MAPPING: Record<string, string> = {
  amount: 'b."amount"',
  bonusType: 'b."bonusType"',
  status: 'b."status"',
  applicableMonth: 'b."applicableMonth"',
  applicableYear: 'b."applicableYear"',
  createdAt: 'b."createdAt"',
  updatedAt: 'b."updatedAt"',
};
