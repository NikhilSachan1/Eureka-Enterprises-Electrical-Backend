# Advance Payment — payout through the Payment Sheet

Status: **spec**. Written off the current code, so every "already works" below was checked, not
assumed.

## The point

Every payable amount in this system leaves through one route: **Book Payment → Payment Sheet →
Bank Transfer → Payment Advice**. An advance payment is money owed to a vendor, but it sits outside
that route — it can only be paid by someone manually creating a book payment for it. This puts it
on the same rails as an invoice.

```
PO → Advance Request → Pending → Approve ─┬─> Book Payment (auto-created, auto-approved)
                                          └─> Payment Sheet → Bank Transfer → Payment Advice
                                                                    ↓
                                          Invoice settlement stays manual and separate
```

## Decisions taken

| Question | Answer |
|---|---|
| Settlement — auto-FIFO or manual? | **Manual stays.** Confirmed with the lead. The "settle against the first eligible invoice, then continue to subsequent ones" line in the requirement is the old automatic behaviour that was deliberately removed; it is not part of this work. |
| Does every approved advance reach the payment sheet immediately? | **Yes.** Approval is the gate; there is no second one. |
| Existing approved advances with no book payment? | **Backfill them.** |

## Already true today — no work needed

Three of the requirement's asks are already implemented. Worth showing rather than rebuilding:

1. **The PO ceiling already subtracts invoices.** `assertWithinPoLimit` computes
   `available = poTotal − invoicedTotal − approvedAdvances`
   (`advance-payment.service.ts:137`). The requirement's own example — ₹10L PO, ₹3L + ₹2L invoiced,
   so ₹5L maximum — is exactly what it does, and it is re-checked on edit against the advance's own
   contribution.
2. **Default status is already `PENDING`.**
3. **The GET API already returns the settlement summary** — `settlements[]` and `settlementCount`
   per advance, each row carrying invoice number, date, amount and settled-at, and the mirror
   `advanceSettlements[]` on the invoice.

Also already true, and the reason this feature is smaller than it looks:

- `book_payments` already supports advances: `sourceType` = `INVOICE` | `ADVANCE`, a nullable
  `invoiceId`, an `advancePaymentId`, and a DB CHECK that exactly one source is set.
- `createFromAdvance` already validates the advance is approved, caps the amount at
  `advance.amount − already booked`, writes the row **already approved and locked**, sets
  `hasBookPayment`, and rolls up the PO. It just has to be *called by* approval instead of by hand.
- The PURCHASE-side bank transfer is driven off the book payment (`bp.siteId`, `bp.vendorId`,
  `bp.poId`), not the invoice, and already guards 1:1 and exact-amount. It tolerates a null
  `invoiceId` — the invoice rollup is wrapped in `if (invoice)`.
- The payment advice PDF already prints `invoiceNumber ?? '-'`, so it will not break; it will just
  be blank where advance details belong.

## The actual work

### 1. Approval creates the book payment

`AdvancePaymentService.approve()` gains, inside the same transaction as the approval:

- create the book payment for **the full advance amount** (that is what is payable), dated the
  approval date, `createdBy` = the approver,
- `approvalStatus: APPROVED`, `isLocked: true` — no second approval, because the advance itself was
  just approved,
- `hasBookPayment = true` on the advance, and the PO's `bookedTotal` rolled up.

Same transaction on purpose: an approval that records money as payable but fails to create the
payable row — or the reverse — is worse than neither happening.

**Duplicates** are prevented by the existing `sumByAdvance` ceiling plus `hasBookPayment`; approval
re-run on an already-approved advance is already refused upstream.

The manual `POST /book-payments` route with `sourceType: ADVANCE` stays exactly as it is, and the
invoice-based ADD/UPDATE route is untouched.

### 2. The payment sheet has to stop dropping advance rows

This is the one real gap. `bookPaymentInvoiceDetailQuery`
(`payment-sheet.queries.ts:111`) does:

```sql
INNER JOIN "site_invoices" inv ON inv."id" = bp."invoiceId"
```

An advance-backed book payment has `invoiceId = NULL`, so it **silently disappears** from the
enrichment — the row would be in the sheet with no detail at all.

Change: `LEFT JOIN` the invoice, `LEFT JOIN` the advance and its PO, and return whichever applies.
The allocation object gains an `advance` block beside the existing `invoice` one:

```jsonc
{
  "bookPaymentId": "uuid",
  "allocatedAmount": 500000,
  "sourceType": "ADVANCE",           // new — tells the UI which block to read
  "invoice": null,
  "advance": {
    "advancePaymentId": "uuid",
    "advanceNumber": "ADV/2026/42",
    "advanceDate": "2026-09-05",
    "advanceAmount": 500000,
    "poId": "uuid",
    "poNumber": "PO-00311",
    "companyName": "…", "projectName": "…", "city": "…", "state": "…"
  }
}
```

`invoice` stays `null` for advances and the advance block stays `null` for invoices, so nothing
about the existing invoice shape changes. Hold amount / hold reason are not populated for advances
— they are an invoice concept.

### 3. Payment advice carries the advance

The advice data currently sources vendor/site/invoice/PO off the book payment. For an
advance-backed transfer, pass the advance number and PO number where the invoice number goes, so the
document identifies what is being paid.

### 4. Backfill

Existing **approved** advances with no book payment get one, with the PO `bookedTotal` rolled up to
match. Done as a migration so it runs with the deploy, and idempotent: it only touches advances that
have no `book_payments` row.

### 5. Reverse / delete

Nothing new. The existing rules already cover advance-backed rows:
`isLocked` blocks edits, `hasTransfer` forces the reverse flow instead of a delete, and
`refreshAdvanceBookedFlag` clears `hasBookPayment` when the last booking against an advance goes
away, so a mis-booked advance becomes editable again rather than frozen.

What does need checking during implementation: reversing an **auto-created** book payment leaves the
advance approved but unbooked, which would then be re-booked by nothing (approval already happened).
Decision: that is correct — the reverse flow exists precisely to undo a payment, and the manual
`POST /book-payments` route is the way back.

## Out of scope

- Invoice-based book payment behaviour — unchanged, by explicit instruction.
- Advance settlement against invoices — already built and manual; not touched here.
- Hold amount / hold reason for advances.
