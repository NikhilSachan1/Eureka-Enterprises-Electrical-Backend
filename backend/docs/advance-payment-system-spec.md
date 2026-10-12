# Spec — Advance Payment System (PURCHASE side)

**Status:** requirement finalised — all 13 decisions confirmed, awaiting go-ahead to implement
**Date:** 2026-09-05
**Source:** call recording with the lead, transcribed (Hindi/Hinglish). Requirements confirmed
point-by-point with the user before this spec was written.

## 1. Problem

Today the whole PURCHASE payment chain starts from an invoice:

```
PO → JMC → Site Report → Invoice → Book Payment → Bank Transfer → Payment Advice
```

If a vendor has **not yet given a JMC or invoice**, there is no way to pay them at all — nothing
downstream can exist without an invoice row. But the business does need to pay in advance.

**Advance Payment** gives that money a document to hang off, and later reconciles it against the
invoice when the vendor finally raises one.

## 2. Confirmed decisions

Every one of these was answered explicitly by the user:

| # | Question | Decision |
|---|---|---|
| 1 | Advance tied to what level? | **PO** — one advance belongs to one PO |
| 2 | Settlement manual or automatic? | **Automatic** |
| 3 | Advance > invoice — leftover? | **Carries forward** to the next invoice on that PO |
| 4 | Approval flow? | **Yes**, advance needs approval |
| 5 | Can advance exceed the PO? | **No** — must respect PO limit, accounting for what is already booked/advanced |
| 6 | Edit / delete allowed? | Only while **no book payment, no bank transfer, and not settled** |
| 7 | Who can create? | **Operation Manager** + **Site Project Manager** |
| 8 | GST / TDS? | **None at all** — single final amount |
| 9 | Sale side too? | **No — PURCHASE only for now**, sale side deferred |
| 10 | Dashboard representation | New PO rollup `advancePaidTotal` + fix the MV formula (option a) |
| 11 | Settlement trigger | On **invoice approval** |
| 12 | Advance on an unapproved PO? | **No** — PO must be APPROVED |
| 13 | Advance rows filterable in document-status? | **Yes** — via the existing `overallStatus[]` filter |

### The settlement rule, as confirmed

Consume **as much advance as possible**, up to the invoice amount. Never split an invoice into
"part advance, part fresh payment" when advance is available.

| Advance balance | Invoice | Settled from advance | Invoice pendency | Advance left |
|---|---|---|---|---|
| 1,00,000 | 40,000 | **40,000** | **0** | 60,000 |
| 50,000 | 60,000 | **50,000** | **10,000** | 0 |
| 60,000 | 60,000 | 60,000 | 0 | 0 |

Invoice pendency arises **only** when the invoice exceeds the available advance, and only by the
excess.

## 3. Current state — verified in code

| Layer | Fact | Consequence for this feature |
|---|---|---|
| `book_payments.invoiceId` | **NOT NULL**, `@ManyToOne` → `SiteInvoiceEntity` | Must become nullable + a discriminator. **Highest-risk change** |
| `bank_transfers` | `invoiceId` **and** `bookPaymentId` both already nullable (SALE goes direct, PURCHASE via book payment) | **No change needed** — advance rides the existing PURCHASE path |
| `payment_advices` | Hangs off `bankTransferId` (unique) | No structural change; PDF content only |
| `purchase_orders` | Denormalized rollups `invoicedTotal`, `bookedTotal`, `paidTotal`, maintained via `poRepository.adjustRollups()` | Needs a new `advancePaidTotal` |
| `mv_site_financial_summary` / `mv_universal_financial_view` | Aggregate **from those PO rollups** | Formula fix required — see §8 |
| `billing.service` site-closing readiness | Reads the same rollups | Must account for unsettled advances — see §8 |
| `document-status` module | The "pending document" API. Chain is **JMC-anchored** (`getIssues` returns JMC chains) | An advance has **no JMC**, so it cannot slot into the existing chain — see §9 |
| Invoice approval | `site-invoice.service.ts:303 approve()` → calls `adjustRollups({ invoicedTotal: … })` | The settlement hook goes here |

## 4. Data model

### 4a. `advance_payments` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `advanceNumber` | varchar(30) | **System-generated**, unique, config-driven (e.g. `ADV-10001`) |
| `vendorAdvanceNumber` | varchar(100) **null** | The vendor's own reference. **Optional** — some vendors don't provide one |
| `poId` | uuid FK | The PO this advance belongs to |
| `siteId`, `vendorId` | uuid FK | Denormalised, mirroring `book_payments` |
| `advanceDate` | date | |
| `amount` | numeric(15,2) | **Single final amount. No taxable/GST/TDS split** |
| `settledAmount` | numeric(15,2) default 0 | Rollup — how much has been consumed by invoices |
| `fileKey`, `fileName` | varchar **null** | The vendor's temporary/"kind-of" invoice attachment |
| `remarks` | text null | |
| `approvalStatus` | varchar(20) | `PENDING` / `APPROVED` / `REJECTED` — mirrors PO/JMC/Invoice |
| `approvalBy`, `approvalAt`, `rejectionReason` | | Same shape as other financial docs |
| `hasBookPayment` | boolean default false | Guards edit/delete (§10) |
| BaseEntity columns | | createdBy / updatedBy / deletedAt … |

`settledAmount` is a rollup, not the source of truth — §4b rows are. Kept for cheap reads, the same
trade-off the PO rollups already make.

**Derived:** `availableBalance = amount − settledAmount`.

### 4b. `advance_settlements` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `advancePaymentId` | uuid FK | |
| `invoiceId` | uuid FK | |
| `amount` | numeric(15,2) | How much of this advance this invoice consumed |
| `settledAt` | timestamp | |
| `createdBy` | uuid | The approver whose action triggered it |

A separate table rather than a column, because **one advance can be consumed by many invoices**
("10 baar mein settle ho sakta hai") and one invoice can draw on **several** advances. It is also
the audit trail for which rupee went where — reconstructible from nothing else.

### 4c. `book_payments` (alter) — the risky one

```sql
ALTER TABLE book_payments ALTER COLUMN "invoiceId" DROP NOT NULL;
ALTER TABLE book_payments ADD COLUMN "sourceType" varchar(20) NOT NULL DEFAULT 'INVOICE';
ALTER TABLE book_payments ADD COLUMN "advancePaymentId" uuid NULL REFERENCES advance_payments(id);
ALTER TABLE book_payments ADD CONSTRAINT "CHK_BOOK_PAYMENT_SOURCE" CHECK (
  ("sourceType" = 'INVOICE' AND "invoiceId" IS NOT NULL AND "advancePaymentId" IS NULL) OR
  ("sourceType" = 'ADVANCE' AND "advancePaymentId" IS NOT NULL AND "invoiceId" IS NULL)
);
```

The `DEFAULT 'INVOICE'` backfills every existing row correctly, and the CHECK constraint makes
"exactly one source" a database guarantee rather than a convention someone can forget. Dropping
`NOT NULL` is what allows an advance-backed book payment to exist at all.

### 4d. `purchase_orders` (alter)

```sql
ALTER TABLE purchase_orders ADD COLUMN "advancePaidTotal" numeric(15,2) NOT NULL DEFAULT 0;
```

Separate from `paidTotal` deliberately — see §8 for why folding it in breaks the dashboard.

### 4e. Advance number config

Follows the `vendor_code_config` pattern exactly — a `configurations` row (module `advance_payment`,
key `advance_number_config`, valueType `json`) plus a `config_settings` value:

```json
{ "prefix": "ADV-", "padLength": 5, "startFrom": 10001 }
```

Includes `startFrom` from the outset, for the reason learnt on the vendor code: a `MAX(seq)+1`
generator silently restarts at 1 on an empty table without an explicit floor.

## 5. Create + approval flow

```
POST   /advance-payments            (multipart — amount, poId, advanceDate, optional vendorAdvanceNumber, attachment)
GET    /advance-payments            (list, filters: siteId, poId, vendorId, approvalStatus, date range)
GET    /advance-payments/:id
PATCH  /advance-payments/:id        (only while unlocked — §10)
DELETE /advance-payments/:id        (only while unlocked — §10)
POST   /advance-payments/:id/approve
POST   /advance-payments/:id/reject
GET    /advance-payments/next-number   (FE preview, mirrors /vendors/next-code)
```

- `advanceNumber` is generated server-side. `vendorAdvanceNumber` is optional free text.
- **No PDF is generated.** The user was explicit: *"रसीद कुछ नहीं"*. The attachment is what the
  vendor supplied; we do not manufacture a receipt.
- Approval mirrors PO/JMC/Invoice (`PENDING → APPROVED | REJECTED`).
- **Only an APPROVED advance may be booked** and may participate in settlement.

## 6. PO limit validation (decision 5)

On create and on approval:

```
approvedAdvanceTotal(po) + newAmount  ≤  po.totalAmount − po.invoicedTotal
```

The PO's headroom is what is **not yet invoiced** — an advance is money paid against work that has
not been billed, so it competes with the uninvoiced remainder, not the whole PO value. Checking
against `po.totalAmount` alone would let advance + invoices jointly exceed the PO.

Re-checked at approval, not only at create, because several advances can sit PENDING at once and
the create-time check would each pass in isolation.

## 7. Settlement algorithm (decisions 2, 3, 11)

Triggered inside the existing transaction in `site-invoice.service.ts approve()`, right beside the
current `adjustRollups({ invoicedTotal })` call.

```
on invoice approval (invoice I on PO P, amount A):
  advances = APPROVED advance_payments for P
             where amount > settledAmount
             order by advanceDate ASC, createdAt ASC      -- oldest first (FIFO)

  remaining = A
  for each advance in advances while remaining > 0:
      take = min(advance.amount - advance.settledAmount, remaining)
      insert advance_settlements(advance, I, take)
      advance.settledAmount += take
      remaining -= take

  invoice.advanceSettledAmount = A - remaining     -- covered by advance
  invoice pendency              = remaining        -- what still needs paying
```

FIFO by `advanceDate` so the oldest money clears first — matches how anyone reconciling a ledger by
hand would do it, and makes the outcome deterministic rather than dependent on row order.

Worked example (the user's own): advance 1,00,000; invoice 40,000 → `take = 40,000`, remaining 0.
Invoice fully covered, advance balance 60,000 carried forward. **Not** split into part-advance /
part-fresh.

### Reversal

Invoice rejected or unlocked after approval → **delete its `advance_settlements` rows and decrement
`settledAmount`**, restoring the advance balance. This mirrors the existing
`invoicedTotal: -amount` reversal at `site-invoice.service.ts:524`. Without it a rejected invoice
would permanently consume advance that was never really billed.

## 8. Rollups, dashboard and site closing

The dashboard currently computes:

```sql
SUM(po."invoicedTotal" - po."paidTotal") AS "totalPendingBilling"
```

An advance that is paid but not yet invoiced makes `paidTotal` exceed `invoicedTotal`, so this goes
**negative** — a visibly wrong dashboard number, not a rounding nuisance. That is exactly why
decision 10 keeps advances in their own rollup:

| Rollup | Meaning |
|---|---|
| `bookedTotal` | unchanged — includes advance-backed book payments |
| `paidTotal` | unchanged — invoice-backed payments only |
| **`advancePaidTotal`** | **new** — money paid against the PO with no invoice behind it yet |

MV formula becomes:

```sql
SUM(po."invoicedTotal" - po."paidTotal") AS "totalPendingBilling"      -- unchanged, stays ≥ 0
SUM(po."advancePaidTotal")              AS "totalAdvancePaid"          -- new column
SUM(po."advancePaidTotal" - <settled>)  AS "totalUnsettledAdvance"     -- new column
```

Both MVs need recreating (they are refreshed every 5 minutes by
`RefreshFinancialMaterializedViews`, so no data migration — just the definition).

**Site closing readiness** (`billing.service`) must gain a condition: **a site cannot close while
any advance remains unsettled.** Otherwise a site closes with money paid out and no bill against
it, which is precisely the exposure this feature creates.

## 9. Pending-document API (`document-status`)

New requirement from the user: the pending-document API must show *"advance payment exists but
invoice is missing"* until the advance is fully covered.

**The structural problem:** the existing chain is **JMC-anchored** — `getIssues()` returns one row
per JMC chain, and every status (`REPORT_MISSING`, `INVOICE_MISSING`, …) is computed from a JMC
join. An advance payment has **no JMC** — that is the entire premise of the feature — so it cannot
appear as a row in the current query.

**Approach:** add advances as a **separate PO-anchored row type** rather than bending the JMC chain:

- New `OverallStatus.ADVANCE_UNSETTLED`, next-action text *"Invoice pending against advance paid"*
- Surfaced in all three endpoints:
  - `GET /document-status` — new counters `advance_unsettled_count`, `advance_unsettled_amount` in the PURCHASE block
  - `GET /document-status/issues` — advance rows appear alongside JMC rows, with `jmc: null`
  - `GET /document-status/po-breakdown` — advances listed under their PO, next to the JMC subtree
- A row appears while `settledAmount < amount` on an APPROVED advance, and **disappears
  automatically** once fully settled

Consumers of `getIssues` must tolerate `jmc: null` on these rows — a real FE-visible contract
change, called out in §12.

## 10. Edit / delete rules (decision 6)

Editable and deletable **only** while all three hold:

1. No book payment exists (`hasBookPayment = false`)
2. No bank transfer exists (implied by 1, checked anyway)
3. `settledAmount = 0`

Otherwise **409**, with a message naming which condition blocked it. Same spirit as the existing
`assertEditable` on PO/JMC/Invoice.

Rejecting an already-booked advance is likewise blocked — the money has moved.

## 11. Permissions (decision 7)

New permissions, module `financials`:

```
financials.advance-payments.view-list
financials.advance-payments.create
financials.advance-payments.update
financials.advance-payments.delete
financials.advance-payments.approve
```

Seeded and granted to **SUPER_ADMIN, ADMIN, OPERATION_MANAGER**. "Site Project Manager" is **not a
system role** — it is a `site_allocations.role` value — so, exactly as with site-vendor assignment,
the permission is granted coarsely and the **service** narrows it to the PM of that specific site
via `checkSiteCreateAccess(..., { requirePm: true })`.

## 12. Impact on existing functionality

| Area | Risk | Why |
|---|---|---|
| **Book payment (invoice flow)** | 🔴 **High** | `invoiceId` becomes nullable. Every existing create/update/delete/list/query path must tolerate a null `invoiceId`. Regression here breaks the live invoice payment flow |
| **Materialized views** | 🟡 Medium | Both recreated. Wrong formula = visibly wrong dashboard numbers |
| **Site closing readiness** | 🟡 Medium | New blocking condition; a site that could close before may not now — intended, but a behaviour change |
| **`document-status` consumers** | 🟡 Medium | `getIssues` rows may now have `jmc: null`. **FE contract change** |
| **Payment advice PDF** | 🟢 Low | Content-only: "Payment on behalf of Advance Payment" + advance number where the invoice number was |
| **Invoice approval** | 🟡 Medium | Settlement runs inside its transaction. A bug here could fail invoice approval itself — must be inside the existing transaction so it rolls back together |
| **Bank transfer** | 🟢 None | Already nullable on both sides |
| **Existing data** | 🟢 None | `sourceType DEFAULT 'INVOICE'` backfills correctly; `advancePaidTotal DEFAULT 0` |

## 13. Migrations

| # | Migration |
|---|---|
| 1 | `create-advance-payments-table` |
| 2 | `create-advance-settlements-table` |
| 3 | `alter-book-payments-add-advance-source` (nullable `invoiceId`, `sourceType`, `advancePaymentId`, CHECK) |
| 4 | `alter-po-add-advance-paid-total` |
| 5 | `seed-advance-number-config` |
| 6 | `seed-advance-payment-permissions` |
| 7 | `recreate-financial-materialized-views` (advance columns + pendingBilling fix) |

Sequential and each reversible.

## 14. Test plan (dev DB, real API)

**Create / validate**
1. Create advance on a PO → auto `ADV-10001`, PENDING, attachment stored.
2. `vendorAdvanceNumber` omitted → accepted (optional).
3. Amount exceeding PO headroom → **400**.
4. Two PENDING advances that individually fit but jointly exceed → second **400 at approval**.
5. Non-PM, non-office-role user on that site → **403**.

**Book / transfer**
6. Book payment against an APPROVED advance → succeeds, `sourceType = ADVANCE`, `invoiceId` null.
7. Book payment against a PENDING advance → **400**.
8. Bank transfer on that book payment → succeeds; payment advice shows the advance number and
   "on behalf of Advance Payment".
9. **Regression:** the existing invoice → book payment → transfer → advice flow still works
   end-to-end unchanged.

**Settlement**
10. Advance 1,00,000; approve invoice 40,000 → settled 40,000, invoice pendency **0**, balance 60,000.
11. Advance 50,000; approve invoice 60,000 → settled 50,000, invoice pendency **10,000**.
12. Two advances 30,000 + 40,000; invoice 60,000 → FIFO: 30,000 then 30,000; second advance retains 10,000.
13. Reject a settled invoice → settlements deleted, advance balance restored.
14. No advance on the PO → invoice behaves exactly as today.

**Rollups / views**
15. `advancePaidTotal` increments on advance payment, and `totalPendingBilling` **never goes negative**.
16. MV refresh reflects advance columns.
17. Site closing blocked while an advance is unsettled; allowed once settled.

**Pending documents**
18. Unsettled advance appears with `ADVANCE_UNSETTLED` in all three `document-status` endpoints.
19. Fully settled → row disappears.
20. Advance rows carry `jmc: null` without breaking the response.

**Edit / delete**
21. Edit/delete before booking → allowed.
22. After book payment → **409**; after partial settlement → **409**.

## 15. Out of scope

1. **SALE side** — deferred by decision 9. On the sale side an "advance" is money *received*, a
   receivable, so book payment and bank transfer (both outgoing) do not apply. It needs its own
   flow and its own spec; it is not a mirror of this one.
2. **No system-generated PDF** for the advance itself.
3. **GST / TDS** on advances — none, and nothing enters the GST register.
4. **Refund / recovery** of an unused advance (vendor returns money) — decision 3 carries the
   balance forward instead. If recovery is ever needed it is a new document type.

## 16. Resolved — final two items

Both confirmed by the user; the spec is complete.

1. **An advance may only be created against an APPROVED PO.** A PENDING or REJECTED PO returns
   **400**. Rationale: the headroom check in §6 is computed from PO totals, and those are not
   meaningful until the PO itself is approved — an advance against an unapproved PO could be paid
   out against a value that later changes or is rejected outright.

2. **`document-status` advance rows are filterable by `overallStatus`.** `ADVANCE_UNSETTLED` joins
   the existing `overallStatus[]` filter on `GET /document-status/issues`, so the UI can show
   "only advances awaiting an invoice" as its own view rather than only finding them in the
   unfiltered list. It also participates in `includeComplete` the same way the other statuses do —
   a fully settled advance is a completed chain and is excluded by default.
