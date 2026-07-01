# Payment Sheet — Design Specification

> Status: **DRAFT for review** · Owner: akhil · Last updated: 2026-06-24
>
> Consolidates pending settlements (employee expense, employee fuel expense, vendor
> book-payments) into a reviewable, multi-stage **Payment Sheet** that ends in actual
> disbursement by an Accountant, with full edit history and a downloadable PDF.

---

## 1. Goal

An authorized initiator selects beneficiaries from the existing pending-settlement lists
(employees with pending expense/fuel money, vendors with pending book-payment money),
sets an amount to pay each (≤ live pending), and saves as **DRAFT** or **submits**. The
sheet then travels a **configurable approval chain** where edit rights shrink at each
stage, ending at an **Accountant** who pays / holds / rejects each line individually.
Marking a line **PAID** performs the real settlement in the source module.

### Confirmed decisions (2026-06-24)

| # | Decision |
|---|---|
| D1 | **Vendor PAID → create `bank_transfer`(s)** via the existing 1:1 purchase flow (auto payment-advice). Expense/Fuel PAID → insert a `credit` transaction in the respective ledger. In all cases the sheet item records the disbursed amount. |
| D2 | **Line items are split per source.** A user with both expense + fuel pending produces **two** items. |
| D3 | **Accountant has no partial pay** — each item is **PAID (full current amount) / HOLD / REJECTED**. |
| D4 | HR/Admin have **two** rejection-style actions: **RETURN** (back to initiator for rework) and **REJECT** (terminal). |
| D5 | **Initiator = `OPERATION_MANAGER`** only (Q-B). |
| D6 | **HOLD is owned by the accountant who placed it** — only they release it; release returns the item to `PENDING`; a held item **blocks sheet `COMPLETED`** (Q-C). |
| D7 | **A sheet may freely mix employees and vendors** — selection is unrestricted (Q-D). |
| D8 | **Email notifications** on each stage hand-off are in scope for v1 (Q-E). |
| D9 | **Vendor lines are backed by whole book-payment allocations** (§3.2) — accepted as proposed (Q-A). |

---

## 2. Roles & permissions

### 2.1 New role
Current roles: `SUPER_ADMIN, ADMIN, EMPLOYEE, MANAGER, OPERATION_MANAGER, HR, DRIVER`.
**Add `ACCOUNTANT`** (seed migration into `roles`, mapped via `user_roles`).

### 2.2 Permissions (convention `financials.payment-sheets.<action>`)
| Permission | Default roles |
|---|---|
| `financials.payment-sheets.create` | OPERATION_MANAGER (+ any configured initiator role) |
| `financials.payment-sheets.review` | HR |
| `financials.payment-sheets.admin-review` | ADMIN, SUPER_ADMIN |
| `financials.payment-sheets.process` | ACCOUNTANT |
| `financials.payment-sheets.view` | all stage roles |
| `financials.payment-sheets.download` | all stage roles |

Authorization continues to use the existing `@Roles()` + `@RequiredPermission()` guards.
Stage-specific authority (who may act *now*) is enforced in the service against
`currentStage` + the configured chain, **not** only by static role.

---

## 3. Data model

All entities extend `BaseEntity` (`id`, `createdBy/updatedBy/deletedBy`, timestamps, soft delete).
All schema changes ship as **TypeORM migrations** (no `synchronize`, no raw DDL).

### 3.1 `payment_sheets` (header)
| Column | Type | Notes |
|---|---|---|
| `sheetNumber` | varchar | Human ref, e.g. `PS/2526/0001`; generated like payment-advice `referenceNumber` |
| `title` | varchar nullable | |
| `remarks` | text nullable | |
| `financialYear` | varchar(10) | e.g. `2526` |
| `status` | varchar | see §4 |
| `currentStage` | varchar nullable | stage key from configured chain; null when DRAFT/terminal |
| `totalRequestedAmount` | decimal(15,2) | denormalized rollup |
| `totalCurrentAmount` | decimal(15,2) | denormalized rollup |
| `totalPaidAmount` | decimal(15,2) | denormalized rollup |

### 3.2 `payment_sheet_items` (one per beneficiary × source)
| Column | Type | Notes |
|---|---|---|
| `paymentSheetId` | uuid FK | |
| `beneficiaryType` | varchar | `USER` \| `VENDOR` |
| `userId` | uuid nullable | set when USER |
| `vendorId` | uuid nullable | set when VENDOR |
| `sourceType` | varchar | `EXPENSE` \| `FUEL_EXPENSE` \| `VENDOR_PAYMENT` |
| `pendingSnapshot` | decimal(15,2) | live pending at add-time |
| `requestedAmount` | decimal(15,2) | initiator's amount |
| `currentAmount` | decimal(15,2) | live amount after stage edits (what accountant pays) |
| `bankSnapshot` | jsonb | { holderName, accountNumber, bankName, ifscCode } captured for PDF/payout |
| `itemStatus` | varchar | `PENDING` \| `PAID` \| `HOLD` \| `REJECTED` (default PENDING) |
| `paidAmount` | decimal(15,2) nullable | = currentAmount on PAID |
| `paidAt` | timestamp nullable | |
| `paymentRef` | varchar nullable | UTR / bank_transfer id / credit txn id (see §7) |
| `holdReason` | text nullable | |
| `heldBy` | uuid nullable | accountant who placed HOLD; only they may release (D6) |
| `rejectReason` | text nullable | |

> **Vendor allocation (needs confirmation — see §10/Q-A):** because each book-payment →
> bank-transfer is **1:1 and exact** (`transferAmount = paymentTotalAmount`), a vendor item
> is backed by **specific book-payment allocations**. `currentAmount` for a vendor item =
> Σ of its selected book payments. "Decreasing" a vendor amount = **removing whole
> book-payment allocations**, not reducing one partially. Expense/Fuel amounts are freely
> editable because their settlement is an arbitrary-amount credit transaction.
> A child table `payment_sheet_item_book_payments (itemId, bookPaymentId)` records the
> allocation for vendor items.

### 3.3 `payment_sheet_item_history` (amount/line audit)
`itemId`, `paymentSheetId`, `stage`, `action` (`ITEM_ADDED`/`AMOUNT_EDIT`/`ITEM_REMOVED`/`PAID`/`HOLD`/`REJECTED`), `previousAmount`, `newAmount`, `reason`, `changedBy`, `timestamp`.

### 3.4 `payment_sheet_stage_logs` (header workflow trail)
`paymentSheetId`, `fromStage`, `toStage`, `action` (`SUBMIT`/`FORWARD`/`RETURN`/`REJECT`/`COMPLETE`), `actedBy`, `actedRole`, `remarks`, `timestamp`.

---

## 4. Status model

**Sheet `status`:**
`DRAFT → SUBMITTED → IN_REVIEW → PROCESSING → COMPLETED`, plus `RETURNED`, `REJECTED`, `CANCELLED`.

**Item `itemStatus` (accountant only):** `PENDING → PAID | HOLD | REJECTED`.

```
DRAFT ──submit──▶ SUBMITTED ──(enter chain)──▶ IN_REVIEW ──reach accountant──▶ PROCESSING ──all items terminal──▶ COMPLETED
  ▲                    │  HR/Admin                    │ HR/Admin
  │                    ├── return ──▶ RETURNED ──(initiator edits)──▶ DRAFT
  │                    └── reject ──▶ REJECTED (terminal)
  └── cancel (initiator) ──▶ CANCELLED
```

- A sheet reaches `COMPLETED` when every item is `PAID` or `REJECTED` and none remain `HOLD`.
- `currentStage` carries the fine-grained position so the status enum stays small while the chain is configurable.

---

## 5. Configurable approval chain (DB-driven)

Stored in the existing `configurations` / `config_settings` tables — adding a layer above
Operation Manager is a config edit, not a code change.

```jsonc
// configurations.key = "payments.approval_flow"
[
  { "stage": "INITIATION",   "role": "OPERATION_MANAGER", "amountEdit": "free",          "addRemove": false },
  { "stage": "HR_REVIEW",    "role": "HR",                "amountEdit": "free",          "addRemove": false, "canReturn": true, "canReject": true },
  { "stage": "ADMIN_REVIEW", "role": "ADMIN",             "amountEdit": "decrease-only", "addRemove": true,  "canReturn": true, "canReject": true },
  { "stage": "PROCESSING",   "role": "ACCOUNTANT",        "amountEdit": "none",          "processItems": true }
]
```

The service walks this array to compute the next stage on FORWARD and to authorize each action.

---

## 6. Edit rules (invariant chain)

| Stage | May do | Constraint |
|---|---|---|
| Op Manager (INITIATION) | set `requestedAmount` per item; add/remove while DRAFT | `0 < amt ≤ livePending` |
| HR (HR_REVIEW) | edit amount; RETURN; REJECT | `amt ≤ livePending`; reason on RETURN/REJECT |
| Admin (ADMIN_REVIEW) | **decrease** amount only; add/remove beneficiaries; RETURN; REJECT | `amt ≤ amount HR forwarded` (never increase); **reason required** on every change |
| Accountant (PROCESSING) | PAID / HOLD / REJECT per item | no amount edit; `currentAmount ≤ livePending` re-checked at pay-time |

Every amount change and add/remove writes `payment_sheet_item_history` with a reason.
Stage transitions write `payment_sheet_stage_logs`.

---

## 7. Settlement write-back on PAID (D1)

Performed in a DB transaction when an Accountant marks an item **PAID**:

| sourceType | Action | `paymentRef` stores |
|---|---|---|
| `EXPENSE` | Insert `credit` transaction in `expenses` for `currentAmount`, linked to user → pending drops via existing pending-settlement query | new expense (credit) row id |
| `FUEL_EXPENSE` | Insert `credit` transaction in `fuel_expenses` for `currentAmount` | new fuel-expense (credit) row id |
| `VENDOR_PAYMENT` | Create `bank_transfer`(s) for the allocated book payment(s) via existing purchase flow (auto-locks, auto payment-advice) | bank_transfer id(s) / UTR |

Item is stamped `paidAmount`, `paidAt`, `paymentRef`; sheet `totalPaidAmount` rolled up.

**HOLD** parks the item — no settlement. The **accountant who placed the HOLD owns its
release** (`heldBy` recorded on the item); releasing returns the item to `PENDING` so it can
then be PAID/REJECTED. **A held item blocks the sheet from reaching `COMPLETED`.**
**REJECT** drops the item (no settlement, terminal for that line).

---

## 8. Live reconcile / difference

Pending shifts after sheet creation (new approvals, new credits, new book payments).
- `GET /payment-sheets/:id/reconcile` → per item: `pendingSnapshot`, `currentAmount`,
  **`livePending`** (recomputed now), `difference`, and a `conflict` flag when `currentAmount > livePending`.
- Pay-time re-checks `livePending`; an Accountant can never disburse more than is currently owed.

---

## 9. API surface (proposed)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/payment-sheets` | initiator | create DRAFT (+ initial items) |
| GET | `/payment-sheets` | all | list (filter status/stage/createdBy/FY) |
| GET | `/payment-sheets/:id` | all | detail: items + history + stage logs |
| PATCH | `/payment-sheets/:id` | initiator (DRAFT/RETURNED) | edit title/remarks |
| POST | `/payment-sheets/:id/items` | initiator (DRAFT) / admin (ADMIN_REVIEW) | add beneficiary items |
| PATCH | `/payment-sheets/:id/items/:itemId` | HR / Admin | edit amount (rules §6) + reason |
| DELETE | `/payment-sheets/:id/items/:itemId` | admin | remove + reason |
| POST | `/payment-sheets/:id/submit` | initiator | DRAFT/RETURNED → enter chain |
| POST | `/payment-sheets/:id/forward` | HR / Admin | advance to next configured stage |
| POST | `/payment-sheets/:id/return` | HR / Admin | → RETURNED (reason) |
| POST | `/payment-sheets/:id/reject` | HR / Admin | → REJECTED (reason) |
| POST | `/payment-sheets/:id/items/:itemId/pay` | accountant | PAID + settlement (§7) |
| POST | `/payment-sheets/:id/items/:itemId/hold` | accountant | HOLD (reason) |
| POST | `/payment-sheets/:id/items/:itemId/release` | accountant who held it | HOLD → PENDING (D6) |
| POST | `/payment-sheets/:id/items/:itemId/reject` | accountant | REJECTED (reason) |
| GET | `/payment-sheets/:id/reconcile` | all | live pending + diff (§8) |
| GET | `/payment-sheets/:id/pdf` | all | download PDF |

The picker UI reuses the existing pending-settlement endpoints
(`/expenses/pending-settlement`, `/fuel-expenses/pending-settlement`, vendor list/pending).

---

## 10. PDF

Reuse the payment-advice PDF infrastructure (async render → S3 key stored on the sheet).
Layout: header (sheet no, dates, status, totals) + table of items (beneficiary, source,
bank details, amount, item status, paid amount/ref).

---

## 11. DB config keys

| key | value |
|---|---|
| `payments.approval_flow` | the chain array (§5) |
| `payments.sheet_number_format` | e.g. `PS/{FY}/{seq}` |
| `payments.admin_edit_policy` | `decrease-only` (mirrors chain; explicit for clarity) |

---

## 12. Resolved questions

| Q | Resolution |
|---|---|
| Q-A vendor allocation | **Accepted** — vendor items backed by whole book-payment allocations; "decrease" = drop an allocation (D9). |
| Q-B initiator | **`OPERATION_MANAGER`** only (D5). |
| Q-C hold release | **Accountant who held it** releases → item back to `PENDING`; held items block `COMPLETED` (D6). |
| Q-D sheet composition | **Mixed** employees + vendors freely allowed (D7). |
| Q-E notifications | **Email** on stage hand-offs, v1 (D8) — see §12.1. |

### 12.1 Email notifications (v1)

Triggered on each workflow transition, to the role(s) that own the next stage (resolved
from the configured chain) and back to the initiator on RETURN/REJECT/COMPLETED:

| Event | Recipient |
|---|---|
| SUBMIT | next-stage approver (HR) |
| FORWARD | next-stage approver (Admin → Accountant) |
| RETURN | initiator |
| REJECT | initiator |
| COMPLETED (all items terminal) | initiator |

Reuse the existing mail infrastructure; send is best-effort (failure does not roll back the
transition). Exact templates TBD during build.

---

## 13. Migration & build plan (after spec sign-off)

1. Seed `ACCOUNTANT` role + payment-sheet permissions + role-permission maps.
2. Create tables: `payment_sheets`, `payment_sheet_items`, `payment_sheet_item_book_payments`, `payment_sheet_item_history`, `payment_sheet_stage_logs`.
3. Seed `config_settings` for the keys in §11.
4. Module scaffolding: entities → repository → service → controller → DTOs.
5. Wire settlement write-back (§7) through existing expense/fuel/bank-transfer services (service-to-service, no cross-module raw writes).
6. Reconcile endpoint + PDF.
7. Email notifications on stage hand-offs (§12.1), reusing existing mail infra.

---

## 14. Item Verification (per-line, per-stage)

Added so that on a **returned** sheet, reviewers only re-check **new or changed** lines, and
approved lines can't be tampered with by earlier stages.

**Model:** table `payment_sheet_item_verifications (itemId, paymentSheetId, stage, verifiedBy,
verifiedAt)`, unique `(itemId, stage)`. A line is "verified for stage X" iff a row exists.
Rows are hard-deleted when cleared.

**Verifying stages:** stages flagged `verifyItems: true` in `payments.approval_flow`
(HR_REVIEW, ADMIN_REVIEW). INITIATION/PROCESSING don't verify.

**Rules**
1. **Forward gate** — from a `verifyItems` stage, `forward` requires every active (non-rejected)
   line verified for that stage (`ITEMS_NOT_ALL_VERIFIED` otherwise).
2. **Clear on change** — any amount change clears that line's verifications for **all** stages.
3. **Reviewer edit auto-verifies** the line for the editor's own stage; new lines start
   unverified; **Return clears nothing** (only edits do) — unchanged lines stay verified.
4. **Edit-lock** — a line can be edited/removed only if **no later stage has verified it**
   (HR-verified ⇒ OM locked; Admin-verified ⇒ HR & OM locked). An earlier stage may still
   *verify* a locked line; it just can't change the amount. `sync-amounts` (OM) **skips**
   locked lines.

**Endpoints (bulk):** `POST /:id/verify` `{ itemIds?: [] }` (omit `itemIds` = verify all lines
at the stage), `POST /:id/unverify` `{ itemIds: [] }` (perm `view`; stage/role enforced in service).

**GET:** each item gains `verifications[] {stage, verifiedBy, verifiedByName, verifiedAt}`,
`verifiedStages[]`, `isVerifiedForCurrentStage`; sheet gains `verificationSummary
{stage, verified, total, allVerified}` for the current stage.
