// ==================== Enums ====================
export enum SalaryChangeType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  INCREMENT = 'INCREMENT',
  DEACTIVATE = 'DEACTIVATE',
}

// ==================== Error Messages ====================
export const SALARY_CHANGE_LOG_ERRORS = {
  NOT_FOUND: 'Salary change log not found',
};

// ==================== Success Messages ====================
export const SALARY_CHANGE_LOG_RESPONSES = {
  CREATED: 'Salary change log created successfully',
};

// ==================== Field Names ====================
export const SALARY_CHANGE_LOG_FIELD_NAMES = {
  SALARY_CHANGE_LOG: 'Salary Change Log',
};
