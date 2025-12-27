export const CARD_ERRORS = {
  CARD_ALREADY_EXISTS: 'Card already exists',
  CARD_NOT_FOUND: 'Card not found',
  EXPIRY_WARNING_DAYS_CONFIG_NOT_FOUND: 'Card expiry warning days configuration not found',
};

export enum CardExpiryStatus {
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
}

export const DEFAULT_CARD_EXPIRY_WARNING_DAYS = 30; // Fallback if config not found

export enum CardsEntityFields {
  ID = 'ID',
  CARD_NUMBER = 'CARD_NUMBER',
  CARD_TYPE = 'CARD_TYPE',
  HOLDER_NAME = 'HOLDER_NAME',
  EXPIRY_DATE = 'EXPIRY_DATE',
  EXPIRY_STATUS = 'EXPIRY_STATUS',
}
