import {
  TransactionType,
  ApprovalStatus,
} from 'src/modules/fuel-expense/constants/fuel-expense.constants';

/**
 * Which fuel entries are currently holding wallet money.
 *
 * This single predicate is the whole of the deduct/restore behaviour. Every path that changes a
 * fuel expense — create, force-create, edit (new version), approve, reject, approved→rejected,
 * rejected→approved, cancel, delete, bulk approve, bulk delete — changes one of these four columns,
 * so none of them needs wallet code of its own:
 *
 *  - `isActive`      an edit deactivates the old version, so an amount change nets out by itself
 *  - `deletedAt`     a deleted entry stops consuming
 *  - approval status pending and approved consume; rejected and cancelled do not, which *is* the
 *                    "restore on reject" requirement — there is no restore step to forget
 *  - `paymentMode`   cash / UPI / credit never touch the wallet
 *
 * Keyed on **`paymentMode`**, not `transactionType`, because that is already this codebase's marker
 * for a petro-card fill: every fuel balance query excludes them with `paymentMode <> 'petro_card'`
 * (so company card spend stays out of the employee's own ledger), and the "card required for this
 * payment mode" guard in fuel create reads the same field. Keying on anything else here would make
 * the wallet disagree with the screens the same rows already appear on.
 */
export const WALLET_CONSUMING_FUEL_PREDICATE = `
  fe."paymentMode" = '${TransactionType.PETRO_CARD}'
  AND fe."isActive" = true
  AND fe."deletedAt" IS NULL
  AND fe."approvalStatus" IN ('${ApprovalStatus.PENDING}', '${ApprovalStatus.APPROVED}')
`;

/**
 * The balance, plus the parts it is made of.
 *
 * The breakdown is returned alongside so a surprising (or negative) balance can be explained
 * without a second round trip.
 */
export const walletBalanceQuery = `
  WITH recharged AS (
    SELECT COALESCE(SUM(r."amount"), 0) AS total
      FROM petro_card_wallet_recharges r
     WHERE r."deletedAt" IS NULL
  ),
  consumed AS (
    SELECT
      COALESCE(SUM(fe."fuelAmount"), 0) AS total,
      COALESCE(SUM(fe."fuelAmount") FILTER (WHERE fe."approvalStatus" = '${ApprovalStatus.PENDING}'), 0)  AS pending,
      COALESCE(SUM(fe."fuelAmount") FILTER (WHERE fe."approvalStatus" = '${ApprovalStatus.APPROVED}'), 0) AS approved
      FROM fuel_expenses fe
     WHERE ${WALLET_CONSUMING_FUEL_PREDICATE}
  )
  SELECT
    (SELECT total FROM recharged) - (SELECT total FROM consumed) AS balance,
    (SELECT total FROM recharged)    AS "totalRecharged",
    (SELECT total FROM consumed)     AS "totalConsumed",
    (SELECT pending FROM consumed)   AS "pendingConsumed",
    (SELECT approved FROM consumed)  AS "approvedConsumed"
`;

/**
 * The combined ledger: recharges and fuel deductions in one list, newest first.
 *
 * Recharges alone cannot explain the balance, so both sides are returned. Only recharge rows carry
 * `editable: true` — fuel rows are managed from the fuel screen, which is why there is no manual
 * debit API.
 *
 * `$1` type filter (NULL for both), `$2` dateFrom, `$3` dateTo, `$4` limit, `$5` offset.
 */
export const walletTransactionsQuery = `
  WITH ledger AS (
    SELECT
      'RECHARGE'                             AS "type",
      r."id"                                 AS "id",
      r."rechargeDate"                       AS "date",
      r."amount"                             AS "amount",
      true                                   AS "editable",
      r."referenceNumber"                    AS "referenceNumber",
      r."paymentMode"                        AS "paymentMode",
      r."remarks"                            AS "remarks",
      cba."accountHolderName"                AS "paidFromAccount",
      NULL::text                             AS "cardNumber",
      NULL::text                             AS "vehicleNumber",
      NULL::text                             AS "employeeName",
      NULL::text                             AS "approvalStatus",
      r."createdAt"                          AS "createdAt",
      TRIM(CONCAT_WS(' ', u."firstName", u."lastName")) AS "recordedBy"
      FROM petro_card_wallet_recharges r
      LEFT JOIN company_bank_accounts cba ON cba."id" = r."paidFromAccountId"
      LEFT JOIN users u ON u."id" = r."createdBy"
     WHERE r."deletedAt" IS NULL

    UNION ALL

    SELECT
      'FUEL'                                 AS "type",
      fe."id"                                AS "id",
      fe."fillDate"                          AS "date",
      -fe."fuelAmount"                       AS "amount",
      false                                  AS "editable",
      fe."transactionId"                     AS "referenceNumber",
      fe."paymentMode"                       AS "paymentMode",
      fe."description"                       AS "remarks",
      NULL::text                             AS "paidFromAccount",
      c."cardNumber"                         AS "cardNumber",
      vm."registrationNo"                    AS "vehicleNumber",
      TRIM(CONCAT_WS(' ', fu."firstName", fu."lastName")) AS "employeeName",
      fe."approvalStatus"                    AS "approvalStatus",
      fe."createdAt"                         AS "createdAt",
      NULL::text                             AS "recordedBy"
      FROM fuel_expenses fe
      LEFT JOIN cards c            ON c."id"  = fe."cardId"
      LEFT JOIN vehicle_masters vm ON vm."id" = fe."vehicleId"
      LEFT JOIN users fu           ON fu."id" = fe."userId"
     WHERE ${WALLET_CONSUMING_FUEL_PREDICATE}
  )
  SELECT *, COUNT(*) OVER() AS "totalRecords"
    FROM ledger
   WHERE ($1::text IS NULL OR "type" = $1::text)
     AND ($2::timestamp IS NULL OR "date" >= $2::timestamp)
     AND ($3::timestamp IS NULL OR "date" <= $3::timestamp)
   ORDER BY "date" DESC, "createdAt" DESC
   LIMIT $4 OFFSET $5
`;
