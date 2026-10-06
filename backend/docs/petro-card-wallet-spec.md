# PetroCard Wallet

Status: **built and verified on dev** (61 assertions, all passing). Migrations `…074`, `…075` and
`…076` run on **dev only**; UAT and prod untouched.

## What it is

Today each PetroCard is just a card record. This adds **one common wallet** that every active
PetroCard spends from. Recharge the wallet, not the card.

```
Wallet recharge → common balance → any PetroCard → fuel entry → amount deducted
                                                   rejected/cancelled → amount restored
```

Scope: **web only**. The mobile app is untouched in this round.

## The one design decision everything follows from

**The balance is derived, never stored.**

```
balance = SUM(active recharges)
        − SUM(fuel entries that are petro-card, live, and pending-or-approved)
```

There is no balance column and no counter to keep in step.

This matters because of what the fuel module actually is. A fuel expense is **versioned**: editing
one deactivates the old row and writes a new version, and the status can move
`PENDING → APPROVED → REJECTED → APPROVED` in either direction, each flip writing another version.
Counting the paths that change a fuel expense's state:

| Path | Method |
|---|---|
| create (pending) | `create` |
| force-create (straight to approved) | `forceFuelExpense` |
| edit → new version, amount/card/mode may all change | `editFuelExpense` |
| approve | `validateAndUpdateFuelExpenseApproval` |
| reject | same |
| **approved → rejected** (new version) | same |
| **rejected → approved** (new version) | same |
| cancel | same |
| delete | `validateAndDeleteFuelExpense` |
| bulk approve / bulk delete | `handleBulkFuelExpenseApproval`, `bulkDeleteFuelExpenses` |

A stored counter would need a correct adjustment in **every one** of those, including the two
reversals and the edit delta. Miss one and the wallet is silently wrong about money, with nothing
to detect it. Derived, all eleven collapse into a single `WHERE` clause that is true or false for
each row — "restore on reject" is not code anyone has to remember, it is what the predicate already
says.

The data is tiny (recharges plus petro-card fuel rows), so the cost is a sub-millisecond aggregate.

### The predicate

A fuel entry consumes wallet balance when **all** hold:

```sql
"paymentMode" = 'petro_card'
AND "isActive" = true          -- superseded versions stop consuming automatically
AND "deletedAt" IS NULL
AND "approvalStatus" IN ('pending', 'approved')
```

Keyed on **`paymentMode`**, not `transactionType`, because that is already this codebase's marker
for a petro-card fill: every fuel balance query excludes them with `paymentMode <> 'petro_card'`,
and the "card required for this payment mode" guard in fuel create reads the same field. Keying on
anything else would make the wallet disagree with the screens those same rows already appear on.

`petro_card` was **missing from the `payment_modes` config**, so the value could never be submitted
and that existing guard was unreachable. Migration `…076` adds it — without it the wallet cannot be
used at all.

Which gives exactly the behaviour asked for:

| Fuel entry state | Consumes? | Why |
|---|---|---|
| Pending | **yes** | as required |
| Approved | **yes** | as required |
| Rejected | no | → amount restored |
| Cancelled | no | *decided:* treated like rejected — a cancelled entry is not live spend, and leaving it deducted would block that money forever |
| Edited (old version) | no | `isActive = false`; the new version consumes instead, so an amount change nets out by itself |
| Deleted | no | soft-deleted |
| Not a petro-card entry | no | cash/UPI/credit never touch the wallet |

## Schema

One table, one migration.

`petro_card_wallet_recharges` — standard `BaseEntity` (id, timestamps, soft delete, created/updated/deletedBy) plus:

| Column | Type | Notes |
|---|---|---|
| `amount` | `decimal(12,2)` NOT NULL | CHECK `> 0`. Recharges only add; there is no manual debit, as asked |
| `rechargeDate` | `timestamp` NOT NULL | when the money actually went in |
| `referenceNumber` | `varchar(100)` NULL | UTR / cheque no. |
| `paymentMode` | `varchar(30)` NULL | how the recharge itself was paid |
| `paidFromAccountId` | `uuid` NULL → `company_bank_accounts` | which org account funded it — same pattern the rest of the app uses |
| `remarks` | `text` NULL | |

Indexes on `rechargeDate` and `deletedAt`.

No `petro_card_wallets` table: there is one wallet, and with a derived balance it would hold
nothing but its own id.

## Concurrency

Blocking on insufficient balance means reading the balance and writing the fuel entry must not
interleave with another entry doing the same — otherwise two entries of ₹600 each both pass against
a ₹1,000 balance and the wallet lands at −₹200.

With no balance row there is nothing to `SELECT … FOR UPDATE`, so the check takes a **transaction
advisory lock** on a fixed key before reading:

```sql
SELECT pg_advisory_xact_lock(<wallet key>);
```

It releases with the transaction, held only for the few statements between the read and the insert.
Recharge create/update/delete take the same lock, so a recharge cannot slip in mid-check either.

## Wallet APIs

New module `petro-card-wallet`, routes under `/petro-card-wallet`.

### `GET /petro-card-wallet/balance`

```jsonc
{ "balance": 4000, "totalRecharged": 5000, "totalConsumed": 1000,
  "pendingConsumed": 1000, "approvedConsumed": 0, "asOf": "2026-09-29T…" }
```

The split is there so a negative or surprising balance can be explained without a second call.

### `GET /petro-card-wallet/transactions`

The recharge/transaction summary — paginated, newest first, filterable by `type` and date range.
Recharges **and** deductions, because a summary of recharges alone cannot explain the balance:

```jsonc
{ "records": [
    { "type": "FUEL", "id": "<fuelExpenseId>", "date": "2026-09-28", "amount": -1000,
      "editable": false,
      "meta": { "cardNumber": "…", "vehicleNumber": "…", "employeeName": "…",
                "approvalStatus": "pending", "remarks": "…" } },
    { "type": "RECHARGE", "id": "<rechargeId>", "date": "2026-09-27", "amount": 5000,
      "editable": true,
      "meta": { "referenceNumber": "UTR…", "paymentMode": "NEFT", "paidFromAccount": "…",
                "remarks": "…", "recordedBy": "…" } }
  ], "totalRecords": 2 }
```

`editable` tells the UI which rows the CRUD buttons belong on. Fuel rows are read-only here — they
are managed from the fuel screen, which is also why no manual debit API exists.

**No running "balance after" column.** The draft of this spec promised one; it was dropped while
building, because this list is both filterable and paginated. A running total would be computed
over whatever subset was asked for and would not be the real balance at that moment — a number that
looks authoritative and is wrong. `/balance` is the honest answer, and the FE shows it in the
header.

### Recharge CRUD

| | |
|---|---|
| `GET /petro-card-wallet/recharges` | the CRUD grid — recharges only, paginated/filterable |
| `POST /petro-card-wallet/recharges` | `{ amount, rechargeDate, referenceNumber?, paymentMode?, paidFromAccountId?, remarks? }` |
| `PATCH /petro-card-wallet/recharges/:id` | same fields, all optional |
| `DELETE /petro-card-wallet/recharges/:id` | soft delete |

Delete and amount-reduction need no reversal code: the row leaves the `SUM`, so the balance moves
by itself. **A delete is allowed even when it drives the balance negative** — the money may already
have been spent, and the operator is trusted to fix it. The consequence is worth stating: once
negative, new petro-card fuel entries are blocked until the wallet is recharged.

## Fuel entry changes

Everything the fuel module gained is in the table below — **one helper and three calls to it**, all
about blocking. Nothing is needed for deduct or restore: those follow from the predicate.

| File | Change |
|---|---|
| `fuel-expense.module.ts` | imports `PetroCardWalletModule` |
| `fuel-expense.service.ts` | injects `PetroCardWalletService`; adds `assertWalletCoversEntry(paymentMode, fuelAmount, em)`; calls it from `create`, `forceFuelExpense` and `editFuelExpense` |

The helper is a no-op unless `paymentMode === 'petro_card'`, so every other fuel entry is untouched.
It runs **inside the caller's transaction**, which is what makes the advisory lock it takes cover
the insert that follows — otherwise two entries could both pass against the same balance.

- **`create`** — the ordinary pending entry. Pending already holds the money, so it is gated.
- **`forceFuelExpense`** — created already APPROVED, which consumes just the same, so gated
  identically.
- **`editFuelExpense`** — called *after* the old version is deactivated, so the balance read
  already excludes it. Checking first would count the entry twice and refuse an edit that merely
  nudges the amount up by ₹10. It takes the DTO's payment mode falling back to the existing one, so
  switching a cash entry onto the card is gated and switching off frees the money with no extra
  code.

The refusal:

> Insufficient PetroCard Wallet balance. Available ₹4,000.00, this entry needs ₹5,000.00. Recharge
> the wallet before recording this fuel entry.

**Nothing was added to approve, reject, cancel, delete or the bulk operations.** That is the point
of deriving the balance: those paths change `isActive`, `deletedAt` or the approval status, and the
predicate does the rest.

**Approval transitions are deliberately not blocked.** Pending and approved both consume, so an
ordinary approval does not move the balance at all. The one case that does is re-approving a
rejected entry, and refusing an approver mid-flow over a balance that dropped after someone else
spent it is worse than letting the wallet go briefly negative — which is visible on the dashboard.
Say if you would rather it were blocked.

## Recharging through the Payment Sheet

A recharge has two origins. Both end in a row in `petro_card_wallet_recharges`; what differs is
**when** the money counts.

| Origin | Raised where | Balance moves | Editable after |
|---|---|---|---|
| Payment Sheet line | `POST /payment-sheets/:id/items` with `beneficiaryType: WALLET` | **when the line is paid** | no — never |
| Manual recharge | `POST /petro-card-wallet/recharges` | immediately | yes, until it is deleted |

The payment sheet is the normal route: the top-up goes through the same approval chain as every
other payable, and the wallet is credited at the moment the money actually leaves. The manual route
stays for corrections and for anything recorded outside that chain.

### The line

```jsonc
{ "beneficiaryType": "WALLET", "sourceType": "PETRO_CARD_WALLET", "requestedAmount": 7000 }
```

That is the whole input. **No beneficiary and no bank details** — there is no vendor to register,
which was the explicit requirement. `beneficiaryType` gains a third value rather than becoming
nullable, so the column stays NOT NULL and every query can still tell the three kinds apart.

Several wallet lines may sit on one sheet: each top-up is its own decision, and there is nothing to
double-pay. The duplicate check that protects user lines is skipped for them — it compares `userId`,
and two nulls would otherwise read as the same beneficiary.

### Unpaid is not in the balance

An unpaid line is **not** counted, which is the point of crediting on payment. So `/balance` reports
it separately:

```jsonc
{ "balance": 4000, "pendingRecharge": 7000, … }
```

Without that figure, someone who just raised a ₹7,000 top-up would see an unchanged balance and
assume it was lost. `pendingRecharge` sums wallet lines in `PENDING` or `HOLD`; a rejected line
drops out of both.

### Paid is final, in both directions

A payment sheet item is already terminal once `PAID` — pay, hold and reject all require `PENDING`,
so nothing in that module can move it. The recharge it produced is locked to match: it carries
`paymentSheetItemId`, and the wallet's own update and delete refuse it. Without that guard the
wallet CRUD would be a back door around a rule the payment sheet enforces.

The credit is written **inside the payment sheet's own stamping transaction**, so the money and the
`PAID` stamp commit together. A unique index on `paymentSheetItemId` makes a retried pay idempotent.

### What does not happen

**No payment advice is generated** — as asked. This needs no code: an advice hangs off a bank
transfer, and only the vendor branch of `payItem` creates one. A wallet line never reaches it.

No bank transfer either, for the same reason, so the missing bank details break nothing downstream.
The only place that would have rendered blanks is the sheet PDF, which now names the line
"PetroCard Wallet" / "PetroCard Wallet Recharge".

## Dashboard

`GET /dashboard/overview` (web) gains:

```jsonc
"petroCardWallet": { "balance": 4000 }
```

`GET /dashboard/mobile` is **not** touched, as scoped.

## Permissions

One migration, following the existing `petro-card.*` names in module `petro_card`:

| Permission | Covers |
|---|---|
| `petro-card.wallet-view` | balance, transactions, recharge list |
| `petro-card.wallet-manage` | create / update / delete recharge |

Granted to **SUPER_ADMIN, ADMIN and OPERATION_MANAGER** — the roles that already hold
`petro-card.add`, checked against the seed rather than assumed.

## Decisions taken, and what they cost

| Decision | Chosen | Consequence to accept |
|---|---|---|
| Balance short at fuel entry | **Block (400)** | A driver cannot log fuel already put in the tank until accounts recharge. That entry is then not recorded anywhere |
| Recharge delete driving balance negative | **Allowed** | Wallet can sit negative; new entries blocked until recharged |
| Cancelled entries | **Restore** | Extended beyond the written requirement, which named only rejected |
| Wallet scope | **One global wallet** | Cards carry no company link today; per-company would mean adding one and mapping existing cards |
| Payment sheet beneficiary | **Optional — none at all** | The sheet shows a line with no payee; the PDF names it rather than printing dashes |
| Recharge entry points | **Both kept** | The balance moves at two different moments, so `pendingRecharge` exists to explain the gap |
| A paid line | **Never reverted** | Already how the payment sheet behaved; the wallet CRUD now matches so it is not a back door |

**The cost of crediting on payment, worth saying plainly:** a top-up now waits for approval and an
actual transfer, which can take days. Fuel entries stay blocked that whole time, where before an
operator could unblock a site immediately. The manual recharge route is the release valve for that,
which is part of why keeping both entry points matters.

## What is deliberately not touched

- Cards themselves — no per-card balance, no card schema change.
- Non-petro-card fuel entries — cash, UPI and credit never reach the wallet.
- The expense ledger and driver reimbursement flow — a PetroCard entry is company money, not an
  employee advance, so nothing there changes.
- Mobile: no API and no permission changes, including the existing `mobile_card_wallet` UI flags
  (which today are visibility toggles only and back nothing).

## What was built

| # | Change | Files |
|---|---|---|
| 1 | Recharge table + CHECK + indexes | `…074-create-petro-card-wallet-recharges.ts` |
| 2 | Two permissions + grants | `…075-seed-petro-card-wallet-permissions.ts` |
| 3 | `petro_card` added to the fuel `payment_modes` config | `…076-seed-petro-card-payment-mode.ts` |
| 4 | Entity, repository, service, controller, DTOs, queries | `src/modules/petro-card-wallet/` |
| 5 | Entity registered on the DataSource | `src/utils/config/config.service.ts` |
| 6 | Module registered | `src/app/app.module.ts` |
| 7 | One helper + three blocking calls | `fuel-expense.service.ts`, `fuel-expense.module.ts` |
| 8 | `petroCardWallet.balance` on `overview` | `dashboard.service.ts`, `dashboard.types.ts` |
| 9 | Recharge via Payment Sheet; recharge↔line link | `…077-alter-wallet-recharge-add-payment-sheet-item.ts`, `payment-sheet.service.ts`, `payment-sheet-pdf.service.ts`, wallet service + queries |

Item 3 was not in the original plan. It surfaced while testing: `paymentMode = 'petro_card'` could
never be submitted because the config did not list it, which also meant the existing
"card required for this payment mode" guard in fuel create had never been reachable.

## Verification

61 assertions on dev, all passing, covering every row of the predicate table — including
approve→reject→approve, edit-amount-up, edit-amount-down, switching payment mode on and off the
card, delete, a zero balance, an entry for exactly the balance, and a recharge delete driving the
balance negative. The harness asserts on deltas against a baseline, because the wallet is global and
dev already carries data. Nothing was left behind.

Not covered by the harness: two concurrent entries racing the same balance. The advisory lock is
there for it, but the race itself is not exercised.
