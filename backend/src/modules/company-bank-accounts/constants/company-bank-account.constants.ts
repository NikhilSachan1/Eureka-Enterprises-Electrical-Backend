export const COMPANY_BANK_ACCOUNT_ERRORS = {
  NOT_FOUND: 'Company bank account not found',
  NOT_ACTIVE: 'This company bank account is inactive',
  IN_USE:
    'This account has been used in past payments and cannot be deleted — deactivate it instead',
} as const;

export const COMPANY_BANK_ACCOUNT_RESPONSES = {
  CREATED: 'Company bank account created successfully',
  UPDATED: 'Company bank account updated successfully',
  DELETED: 'Company bank account deleted successfully',
  SET_DEFAULT: 'Default company bank account updated',
} as const;

export const COMPANY_BANK_ACCOUNT_PERMISSIONS = {
  CREATE: 'financials.company-bank-accounts.create',
  VIEW: 'financials.company-bank-accounts.view',
  UPDATE: 'financials.company-bank-accounts.update',
  DELETE: 'financials.company-bank-accounts.delete',
} as const;
