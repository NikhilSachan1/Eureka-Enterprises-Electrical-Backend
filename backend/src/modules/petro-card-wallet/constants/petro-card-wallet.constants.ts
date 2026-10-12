/**
 * The key `pg_advisory_xact_lock` is taken on before any balance read that a write depends on.
 *
 * The balance is derived, so there is no row to SELECT … FOR UPDATE. Without this lock two fuel
 * entries of ₹600 could both pass an insufficient-balance check against a ₹1,000 balance and leave
 * the wallet at −₹200. An arbitrary constant, unique within the app; the lock is transaction-scoped
 * and releases on commit or rollback.
 */
export const PETRO_CARD_WALLET_LOCK_KEY = 874_100_101;

/**
 * A recharge is a request until the money moves.
 *
 * PENDING rows are what the outstanding list shows and what the Payment Sheet picks from; PAID
 * rows are the only ones the balance counts. Nothing else is needed: a recharge that is rejected
 * on the sheet simply stays PENDING and comes back to the outstanding list.
 */
export enum WalletRechargeStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

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
    'This recharge has already been paid through a Payment Sheet and cannot be edited or ' +
    'deleted. A paid line is final.',
  RECHARGE_ON_A_SHEET:
    'This recharge is already on Payment Sheet {sheet} and cannot be edited or deleted while it ' +
    'is there. Remove it from that sheet first.',
  RECHARGE_NOT_OUTSTANDING:
    'This recharge is not outstanding — it has either been paid already or is already on another ' +
    'Payment Sheet.',
  RECHARGE_ID_REQUIRED: 'rechargeId is required for a PetroCard Wallet line',
};

export const PETRO_CARD_WALLET_RESPONSES = {
  RECHARGE_CREATED:
    'Wallet recharge raised. It will appear in the outstanding list — the balance moves once it ' +
    'is paid through a Payment Sheet.',
  RECHARGE_UPDATED: 'Wallet recharge updated successfully',
  RECHARGE_DELETED: 'Wallet recharge deleted successfully',
};
