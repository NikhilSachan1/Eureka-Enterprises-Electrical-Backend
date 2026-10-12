# Spec — Advance Payment Phase 3: settlement + reversal

**Status:** awaiting approval — one open decision (§3), which changes the numbers users see.
**Prerequisite for:** phase 4 (rollups/MV), phase 5 (site-closing guard), phase 6 (document-status).

## 1. What phase 3 delivers

| | |
|---|---|
| **Settle** | On invoice approval, consume APPROVED advances on that PO, oldest first, writing `advance_settlements` rows and incrementing `advance_payments.settledAmount`. |
| **Reverse** | On invoice unlock (approved → pending), delete those rows and restore the balances. |
| **Prevent double payment** | Reduce the book-payment ceiling for an invoice by whatever an advance already covered. |

The third item is not optional garnish — without it the vendor is paid twice for the same work
(once as advance, once as a book payment against the full invoice). See §4.

## 2. Groundwork already in place

Nothing new is needed in the advance module itself:

- `AdvancePaymentRepository.findSettlableByPo(poId, em)` — APPROVED, `amount > settledAmount`,
  ordered `advanceDate ASC, createdAt ASC`, with `pessimistic_write`. Exactly the FIFO cursor §7 of
  the original spec describes.
- `advance_settlements` table and entity exist (`advancePaymentId`, `invoiceId`, `amount`,
  `settledAt`, `createdBy`), with `onDelete: CASCADE` on both parents.
- `advance_payments.settledAmount` column exists, defaulted 0.

## 3. OPEN DECISION — which invoice figure does an advance consume?

The original spec says "invoice I on PO P, amount A" without defining A. Two candidates already
exist in the codebase and they differ:

| Figure | Definition | Used today by |
|---|---|---|
| `inv.totalAmount` | gross invoice value | PO ceiling + `invoicedTotal` rollup |
| **net payable** | `isGstHold ? taxable − tds : taxable + gst − tds` | book-payment ceiling ([`book-payment.service.ts:72`](../src/modules/book-payments/book-payment.service.ts#L72)) |

Worked example — invoice taxable ₹1,00,000, GST ₹18,000, TDS ₹2,000, advance ₹1,00,000:

| | Settles | Invoice left to pay | Advance balance |
|---|---|---|---|
| **A. against `totalAmount` (₹1,18,000)** | ₹1,00,000 | ₹18,000 | ₹0 |
| **B. against net payable (₹1,16,000)** | ₹1,00,000 | ₹16,000 | ₹0 |

**Recommendation: B (net payable).** An advance is *cash handed to the vendor*, so it should offset
*cash the vendor is owed*. TDS is withheld and never paid to the vendor; GST under `isGstHold` is
not paid either. Settling against `totalAmount` would treat money the vendor never receives as
having been advanced to them, and would leave the book-payment ceiling and the settlement figure
computed off two different bases — the exact kind of mismatch that makes a ledger stop reconciling.

Everything below assumes B. If A is preferred, only the one expression changes.

## 4. Preventing double payment (the part that must not be deferred)

Today the book-payment ceiling is:

```ts
remaining = invoiceNetPayable − existingBooked
```

After settlement it must become:

```ts
remaining = invoiceNetPayable − invoice.advanceSettledAmount − existingBooked
```

Applied in **both** `BookPaymentService.create()` ([`:78`](../src/modules/book-payments/book-payment.service.ts#L78))
and `update()` ([`:279`](../src/modules/book-payments/book-payment.service.ts#L279)), which re-checks
the ceiling on an amount change.

This requires a new column:

- **`site_invoices.advanceSettledAmount`** — `numeric(15,2) NOT NULL DEFAULT 0`. Maintained only by
  settle/reverse, never by user input, never exposed on any write DTO.

Error messages gain the advance figure so the user understands why less is bookable than the
invoice face value suggests.

## 5. Where the code goes

### 5.1 Settle — `SiteInvoiceService.approve()`

Inside the existing transaction, immediately after the `adjustRollups({ invoicedTotal })` call
([`site-invoice.service.ts:373`](../src/modules/site-invoices/site-invoice.service.ts#L373)) and
before the GST/TDS projection:

```
netPayable   = isGstHold ? taxable − tds : taxable + gst − tds
advances     = advanceRepository.findSettlableByPo(inv.poId, em)   // locks rows, FIFO
remaining    = netPayable
for advance of advances while remaining > 0:
    take = min(advance.amount − advance.settledAmount, remaining)
    insert advance_settlements { advancePaymentId, invoiceId, amount: take, createdBy }
    advance.settledAmount += take
    remaining −= take
invoice.advanceSettledAmount = netPayable − remaining
```

Sale-side invoices need no guard: advances only ever exist against PURCHASE POs, so
`findSettlableByPo` returns nothing for a sale PO.

### 5.2 Reverse — `SiteInvoiceService.grantUnlock()`

This is the **only** undo path, confirmed by reading the alternatives:

- `reject()` refuses an APPROVED invoice outright (`CANNOT_REJECT_APPROVED`)
- `remove()` is gated by `assertEditable`, which an approved+locked invoice fails

So reversal goes beside the existing `invoicedTotal: -amount` reversal
([`:524`](../src/modules/site-invoices/site-invoice.service.ts#L524)), inside the same
`if (approvalStatus === APPROVED)` block:

```
rows = advance_settlements where invoiceId = inv.id
for row of rows:
    advance.settledAmount −= row.amount        // row-locked first
delete those rows
invoice.advanceSettledAmount = 0
```

Re-approving after an edit then re-settles from scratch against the new amount, so no stale
apportionment can survive.

### 5.3 Lock ordering

Settle and reverse both take PO lock → advance locks, in that order, matching what `approve()`
already does. `findSettlableByPo` orders deterministically by `advanceDate, createdAt`, so two
concurrent approvals on the same PO acquire advance locks in the same sequence and cannot deadlock.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| No advances on the PO | Loop runs zero times; `advanceSettledAmount` stays 0. Existing flows unchanged. |
| Advances total < invoice | Invoice partly covered; `remaining` is booked and paid normally. |
| Advance larger than invoice | `take` is capped at the invoice; balance carries forward to the next invoice. Matches decision 3 — no splitting. |
| Two invoices approved concurrently on one PO | Second blocks on the advance row locks, then reads the updated `settledAmount`. No over-settlement. |
| Invoice unlocked, edited smaller, re-approved | Full reversal then fresh settlement; balances land on the new amount. |
| Invoice fully covered by advance | `remaining = 0`; book payment against it is refused as fully booked — correct, nothing is owed in cash. |
| Advance edited/deleted after settling | Already blocked: `assertMutable` refuses once `settledAmount > 0`. |
| Book payment already exists, then invoice unlocked | Existing `CANNOT_UNLOCK_*` guards fire first; unaffected. |

## 7. Not in phase 3

Deliberately excluded so this ships as one reviewable change:

- `po.advancePaidTotal` rollup and the MV columns (phase 4)
- Site-closing guard on unsettled advances (phase 5)
- `document-status` `ADVANCE_UNSETTLED` rows (phase 6)
- Creating an advance-backed **book payment** — `CreateBookPaymentDto` still accepts only
  `invoiceId`. Note this means `hasBookPayment` stays `false`, so after phase 3 the only thing that
  can freeze an advance is settlement.

## 8. Migration

`…063-alter-site-invoices-add-advance-settled.ts` — add
`site_invoices.advanceSettledAmount numeric(15,2) NOT NULL DEFAULT 0`. No backfill: nothing has ever
settled, so 0 is correct for every existing row. `down()` drops the column.

## 9. Test plan (dev DB, real API)

1. Approve an invoice on a PO with no advances → unchanged behaviour, `advanceSettledAmount = 0`.
2. Advance ₹1,00,000, approve invoice net payable ₹40,000 → one settlement row of ₹40,000, advance
   balance ₹60,000, `advanceSettledAmount = 40,000`.
3. Same again → advance balance ₹20,000; FIFO consumed in `advanceDate` order across two advances.
4. Advance ₹40,000, invoice net payable ₹1,00,000 → advance fully consumed, `remaining` ₹60,000.
5. Book payment on (4) is capped at ₹60,000; ₹60,001 → 400 naming the advance figure.
6. Book payment on a fully-covered invoice → refused as fully booked.
7. Unlock the invoice from (2) → settlement row gone, advance balance back to ₹1,00,000,
   `advanceSettledAmount = 0`.
8. Re-approve after editing the invoice smaller → settles the new figure only.
9. Edit/delete the advance once settled → still refused by `assertMutable`.
10. Two concurrent approvals on one PO → total settled never exceeds the advance.
11. `GET /advance-payments/:id` now shows a real `settledAmount` / `balanceAmount` / `isFullySettled`.
12. Sale-side invoice approval → untouched.
