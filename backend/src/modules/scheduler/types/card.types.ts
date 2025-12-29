import { CardExpiryStatus } from '../../cards/constants/card.constants';

/**
 * Types for CRON 15: Card Expiry Alerts
 *
 * Cards include: Petro Cards, Toll Cards, Fleet Cards, etc.
 * These cards have expiry dates and need timely renewal.
 */

export interface CardAlert {
  cardId: string;
  cardNumber: string;
  cardType: string;
  holderName: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: CardExpiryStatus;
}

export interface CardExpiryCount {
  expired: number;
  expiringSoon: number;
  total: number;
}

export interface CardExpiryResult {
  totalCardsProcessed: number;
  expiredCards: CardExpiryCount;
  expiringSoonCards: CardExpiryCount;
  emailsSent: number;
  recipients: string[];
  errors: string[];
}

export interface CardEmailItem {
  cardId: string;
  cardNumber: string;
  maskedCardNumber: string;
  cardType: string;
  cardTypeLabel: string;
  holderName: string;
  expiryDate: string;
  daysText: string;
  statusClass: 'expired' | 'expiring-soon';
}

export interface CardExpiryEmailData {
  currentYear: number;
  adminPortalUrl: string;
  totalExpired: number;
  totalExpiringSoon: number;
  expiredCards: CardEmailItem[];
  expiringSoonCards: CardEmailItem[];
  hasExpired: boolean;
  hasExpiringSoon: boolean;
}

export interface CardQueryResult {
  id: string;
  cardNumber: string;
  cardType: string;
  holderName: string;
  expiryDate: string;
  expiryStatus: string;
  daysUntilExpiry: number;
}
