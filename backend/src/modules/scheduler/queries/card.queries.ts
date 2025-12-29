import { CardExpiryStatus } from '../../cards/constants/card.constants';

/**
 * Card Expiry Queries
 *
 * Queries for CRON 15: Card Expiry Alerts
 *
 * Fetches cards that are:
 * - Expired (expiryDate < today)
 * - Expiring Soon (expiryDate <= today + warningDays)
 *
 * Note: Cards store expiryDate as 'MM/YY' format string
 * We convert it to a proper date for comparison
 */

/**
 * Get all cards that are expired or expiring soon
 *
 * Card expiry date format: 'MM/YY' (e.g., '12/25' for December 2025)
 * We consider end of month as the actual expiry date
 */
export const getCardsWithExpiryQuery = (warningDays: number) => {
  return {
    query: `
      WITH card_expiry_data AS (
        SELECT
          c.id,
          c."cardNumber",
          c."cardType",
          c."holderName",
          c."expiryDate",
          c."expiryStatus",
          -- Convert MM/YY to last day of that month
          -- Extract month and year, construct date as last day of month
          (
            DATE_TRUNC('month', 
              TO_DATE(
                CONCAT('01/', c."expiryDate"),
                'DD/MM/YY'
              )
            ) + INTERVAL '1 month' - INTERVAL '1 day'
          )::date as "actualExpiryDate",
          -- Calculate days until expiry
          (
            (
              DATE_TRUNC('month', 
                TO_DATE(
                  CONCAT('01/', c."expiryDate"),
                  'DD/MM/YY'
                )
              ) + INTERVAL '1 month' - INTERVAL '1 day'
            )::date - CURRENT_DATE
          ) as "daysUntilExpiry"
        FROM cards c
        WHERE c."deletedAt" IS NULL
      )
      SELECT
        id,
        "cardNumber",
        "cardType",
        "holderName",
        "expiryDate",
        "expiryStatus",
        "actualExpiryDate",
        "daysUntilExpiry"
      FROM card_expiry_data
      WHERE "daysUntilExpiry" <= $1
      ORDER BY "daysUntilExpiry" ASC
    `,
    params: [warningDays],
  };
};

/**
 * Get summary counts of expiring cards
 * Used for dashboard/reporting
 * TODO: This can be used to show card expiry summary on dashboard
 */
export const getCardExpirySummaryQuery = (warningDays: number) => {
  return {
    query: `
      WITH card_expiry_data AS (
        SELECT
          (
            (
              DATE_TRUNC('month', 
                TO_DATE(
                  CONCAT('01/', c."expiryDate"),
                  'DD/MM/YY'
                )
              ) + INTERVAL '1 month' - INTERVAL '1 day'
            )::date - CURRENT_DATE
          ) as "daysUntilExpiry"
        FROM cards c
        WHERE c."deletedAt" IS NULL
      )
      SELECT
        COUNT(CASE WHEN "daysUntilExpiry" < 0 THEN 1 END)::int as "expiredCount",
        COUNT(CASE WHEN "daysUntilExpiry" >= 0 AND "daysUntilExpiry" <= $1 THEN 1 END)::int as "expiringSoonCount"
      FROM card_expiry_data
    `,
    params: [warningDays],
  };
};

export const getCardExpiryStatus = (daysRemaining: number): CardExpiryStatus => {
  if (daysRemaining < 0) {
    return CardExpiryStatus.EXPIRED;
  }
  return CardExpiryStatus.EXPIRING_SOON;
};

export const getCardTypeLabel = (cardType: string): string => {
  const labels: Record<string, string> = {
    PETRO_CARD: 'Petro Card',
    TOLL_CARD: 'Toll Card',
    FLEET_CARD: 'Fleet Card',
    OTHER: 'Other',
  };
  return labels[cardType] || cardType;
};

export const maskCardNumber = (cardNumber: string): string => {
  if (!cardNumber || cardNumber.length < 4) {
    return cardNumber || 'N/A';
  }
  const lastFour = cardNumber.slice(-4);
  return `•••• •••• •••• ${lastFour}`;
};
