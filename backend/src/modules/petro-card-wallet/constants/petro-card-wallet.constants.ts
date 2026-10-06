/**
 * The key `pg_advisory_xact_lock` is taken on before any balance read that a write depends on.
 *
 * The balance is derived, so there is no row to SELECT … FOR UPDATE. Without this lock two fuel
 * entries of ₹600 could both pass an insufficient-balance check against a ₹1,000 balance and leave
 * the wallet at −₹200. An arbitrary constant, unique within the app; the lock is transaction-scoped
 * and releases on commit or rollback.
 */
export const PETRO_CARD_WALLET_LOCK_KEY = 874_100_101;

export enum WalletTransactionType {
  RECHARGE = 'RECHARGE',
  FUEL = 'FUEL',
}

export const PETRO_CARD_WALLET_ERRORS = {
  RECHARGE_NOT_FOUND: 'Wallet recharge not found',
  AMOUNT_MUST_BE_POSITIVE: 'Recharge amount must be greater than zero',
  BANK_ACCOUNT_NOT_FOUND: 'The selected bank account was not found',
  INSUFFICIENT_BALANCE:
    'Insufficient PetroCard Wallet balance. Available {available}, this entry needs {required}. ' +
    'Recharge the wallet before recording this fuel entry.',
  RECHARGE_FROM_PAYMENT_SHEET:
    'This recharge came from a paid Payment Sheet line and cannot be edited or deleted. ' +
    'A paid line is final.',
};

export const PETRO_CARD_WALLET_RESPONSES = {
  RECHARGE_CREATED: 'Wallet recharge recorded successfully',
  RECHARGE_UPDATED: 'Wallet recharge updated successfully',
  RECHARGE_DELETED: 'Wallet recharge deleted successfully',
};
