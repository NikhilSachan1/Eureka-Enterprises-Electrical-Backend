import {
  TransactionType,
  ApprovalStatus,
} from 'src/modules/fuel-expense/constants/fuel-expense.constants';
import { WalletRechargeStatus } from '../constants/petro-card-wallet.constants';

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
 * Is this recharge currently claimed by a Payment Sheet line that is still alive?
 *
 * Derived rather than stored, for the same reason the balance is. Picking a recharge onto a sheet
 * sets `paymentSheetItemId`; if that line is later removed, or the line or the whole sheet is
 * rejected or cancelled, the recharge has to become outstanding again. Deriving it means there is
 * no release step in removeItem, rejectItem, rejectSheet and deleteSheet for anyone to forget —
 * those four already do exactly what this reads.
 *
 * Expects the recharge aliased as `r`.
 */
export const RECHARGE_CLAIMED_BY_LIVE_SHEET = `
  EXISTS (
    SELECT 1
      FROM payment_sheet_items psi
      JOIN payment_sheets ps ON ps."id" = psi."paymentSheetId"
     WHERE psi."id" = r."paymentSheetItemId"
       AND psi."deletedAt" IS NULL
       AND psi."itemStatus" <> 'REJECTED'
       AND ps."deletedAt" IS NULL
       AND ps."status" NOT IN ('REJECTED', 'CANCELLED')
  )
`;

/**
 * A recharge nobody has paid and no live sheet is holding — the outstanding list, and the only
 * thing a Payment Sheet is allowed to pick a wallet line from.
 */
export const RECHARGE_IS_OUTSTANDING = `
  r."status" = '${WalletRechargeStatus.PENDING}'
  AND r."deletedAt" IS NULL
  AND NOT ${RECHARGE_CLAIMED_BY_LIVE_SHEET}
`;

/**
 * The balance, plus the parts it is made of.
 *
 * The breakdown is returned alongside so a surprising (or negative) balance can be explained
 * without a second round trip.
 */
export const walletBalanceQuery = `
  WITH recharged AS (
    -- PAID only. A recharge that has merely been raised is a request, not money: these used to
    -- count the moment the row was written, which showed a balance against a payment nobody had
    -- made.
    SELECT COALESCE(SUM(r."amount"), 0) AS total
      FROM petro_card_wallet_recharges r
     WHERE r."deletedAt" IS NULL
       AND r."status" = '${WalletRechargeStatus.PAID}'
  ),
  consumed AS (
    SELECT
      COALESCE(SUM(fe."fuelAmount"), 0) AS total,
      COALESCE(SUM(fe."fuelAmount") FILTER (WHERE fe."approvalStatus" = '${ApprovalStatus.PENDING}'), 0)  AS pending,
      COALESCE(SUM(fe."fuelAmount") FILTER (WHERE fe."approvalStatus" = '${ApprovalStatus.APPROVED}'), 0) AS approved
      FROM fuel_expenses fe
     WHERE ${WALLET_CONSUMING_FUEL_PREDICATE}
  ),
  -- Everything raised and not yet paid, whether it is still in the outstanding list or already
  -- on a sheet awaiting payment. Deliberately NOT part of the balance — reported beside it so
  -- someone who just raised ₹50,000 can see it was not lost when the balance did not move.
  awaiting AS (
    SELECT
      COALESCE(SUM(r."amount"), 0) AS total,
      COALESCE(SUM(r."amount") FILTER (WHERE NOT ${RECHARGE_CLAIMED_BY_LIVE_SHEET}), 0) AS outstanding
      FROM petro_card_wallet_recharges r
     WHERE r."deletedAt" IS NULL
       AND r."status" = '${WalletRechargeStatus.PENDING}'
  )
  SELECT
    (SELECT total FROM recharged) - (SELECT total FROM consumed) AS balance,
    (SELECT total FROM recharged)    AS "totalRecharged",
    (SELECT total FROM consumed)     AS "totalConsumed",
    (SELECT pending FROM consumed)   AS "pendingConsumed",
    (SELECT approved FROM consumed)  AS "approvedConsumed",
    (SELECT total FROM awaiting)       AS "pendingRecharge",
    (SELECT outstanding FROM awaiting) AS "outstandingRecharge"
`;
/**
 * The outstanding list: recharges raised, not paid, and not held by any live sheet.
 *
 * This is the wallet's answer to "what does the company still owe?", and it is what the Payment
 * Sheet's beneficiary picker reads. A list of its own rather than a row bolted onto the per-employee
 * pending-settlement API: a wallet top-up has no employee, no employee code and no bank details, so
 * it cannot take that shape without breaking it for every caller that already reads those fields.
 *
 * `$1` limit, `$2` offset.
 */
export const outstandingRechargesQuery = `
  SELECT
    r."id"                                 AS "id",
    r."amount"                             AS "amount",
    r."rechargeDate"                       AS "rechargeDate",
    r."remarks"                            AS "remarks",
    r."createdAt"                          AS "createdAt",
    TRIM(CONCAT_WS(' ', u."firstName", u."lastName")) AS "raisedBy",
    COUNT(*) OVER()                        AS "totalRecords",
    SUM(r."amount") OVER()                 AS "totalOutstanding"
    FROM petro_card_wallet_recharges r
    LEFT JOIN users u ON u."id" = r."createdBy"
   WHERE ${RECHARGE_IS_OUTSTANDING}
   ORDER BY r."rechargeDate" ASC, r."createdAt" ASC
   LIMIT $1 OFFSET $2
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
      -- Editable only while it is still a request nobody has acted on. A paid recharge is a
      -- record of a payment and is final; one already picked onto a live sheet must not change
      -- amount under the accountant who is about to pay it.
      (${RECHARGE_IS_OUTSTANDING})            AS "editable",
      r."status"                             AS "rechargeStatus",
      r."referenceNumber"                    AS "referenceNumber",
      r."paymentMode"                        AS "paymentMode",
      r."remarks"                            AS "remarks",
      CASE
        WHEN cba."id" IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', cba."id",
          'accountName', cba."accountName",
          'accountHolderName', cba."accountHolderName",
          'bankName', cba."bankName",
          'accountNumber', cba."accountNumber",
          'ifscCode', cba."ifscCode",
          'branchName', cba."branchName"
        )
      END                                    AS "paidFromAccount",
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
      NULL::varchar                          AS "rechargeStatus",
      fe."transactionId"                     AS "referenceNumber",
      fe."paymentMode"                       AS "paymentMode",
      fe."description"                       AS "remarks",
      NULL::jsonb                            AS "paidFromAccount",
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
