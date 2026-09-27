# Advance Payments — Frontend Integration Guide

Documents what is **actually shipped**, read off the code. The feature is now complete: create,
approve, manual settlement against invoices (§8), and booking the advance out (§9).

Base path: `/api/v1/advance-payments`. All routes need the usual four headers
(`X-Active-Role`, `X-Correlation-Id`, `X-Source-Type`, `X-Client-Type`) plus the bearer token.

---

## 1. What an advance payment is

Money paid to a vendor against an **approved PURCHASE purchase order**, *before* the vendor has
raised any JMC or invoice.

Two consequences that shape the whole UI:

- **No tax breakup.** An advance is a single final `amount`. There is no taxable / GST / TDS split
  anywhere in the request or the response — do not reuse the invoice form.
- **It competes with the uninvoiced part of the PO**, not the whole PO value. See §4.

---

## 2. Endpoints

| # | Method | Path | Permission |
|---|---|---|---|
| 1 | POST | `/advance-payments` | `financials.advance-payments.create` |
| 1a | GET | `/advance-payments/dropdown` | `financials.advance-payments.view-list` |
| 2 | GET | `/advance-payments` | `financials.advance-payments.view-list` |
| 3 | GET | `/advance-payments/:id` | `financials.advance-payments.view-list` |
| 4 | PATCH | `/advance-payments/:id` | `financials.advance-payments.update` |
| 5 | DELETE | `/advance-payments/:id` | `financials.advance-payments.delete` |
| 6 | POST | `/advance-payments/:id/approve` | `financials.advance-payments.approve` |
| 7 | POST | `/advance-payments/:id/reject` | `financials.advance-payments.approve` |
| 8 | POST | `/site-invoices/:id/advance-settlements` | `financials.advance-payments.settle` |
| 9 | DELETE | `/site-invoices/:id/advance-settlements/:settlementId` | `financials.advance-payments.settle` |
| 10 | DELETE | `/site-invoices/:id/advance-settlements` | `financials.advance-payments.settle` |

Granted to **SUPER_ADMIN, ADMIN, OPERATION_MANAGER**. Note approve and reject share one permission —
gate both buttons on `…approve`. Settlement (8–10) lives on the **invoice** and has its own
permission, `financials.advance-payments.settle`; see §8.

> **Removed:** `GET /advance-payments/next-number`. The advance number is no longer generated
> server-side — see §3.

---

## 3. Create

> **Changed.** `advanceNumber` is now **sent by the client and required**. Nothing is generated or
> previewed server-side; whatever number the vendor's document carries is what is stored.

```
POST /advance-payments
```

```jsonc
{
  "advanceNumber": "ADV/2026/42",       // required — ≤30 chars, trimmed, must be globally unique
  "poId": "uuid",                       // required — approved PURCHASE PO
  "advanceDate": "2026-09-05",          // required — ISO date
  "amount": 50000,                      // required — > 0, max 2 decimals
  "vendorAdvanceNumber": "ADV/2026/42", // optional, ≤100 chars
  "fileKey": "advance-files/…",         // optional — upload first, then send the key
  "fileName": "vendor-proforma.pdf",    // optional, ≤255
  "remarks": "50% mobilisation advance" // optional
}
```

```jsonc
201 → { "message": "Advance payment recorded successfully", "id": "uuid", "advanceNumber": "ADV/2026/42" }
```

**Uniqueness is global**, not per-PO or per-vendor, and ignores soft-deleted rows. A duplicate is a
400: *"Advance number {number} is already used by another advance payment. Enter a different
number."* No format is enforced — any string up to 30
characters is accepted. The number **cannot be changed later**: `PATCH` does not accept
`advanceNumber`. Delete and recreate if it was typed wrong (possible while unbooked and unsettled).

`siteId` and `vendorId` are **derived from the PO** — do not send them, they are ignored.

File upload follows the site-invoice pattern: upload the file through the existing storage endpoint,
then pass the returned key as `fileKey`.

### 3.3 Who can create

The route permission is coarse; the service narrows it. The caller must be the **Project Manager of
that PO's site** (`site_allocations.role = 'Project Manager'`, currently allocated), unless they hold
an office role (SUPER_ADMIN / ADMIN / MANAGER / OPERATION_MANAGER / HR), which bypasses.

A non-PM gets **403**. "Project Manager" is not a system role, so you cannot decide this from
`user.roles` — either let the 403 drive the UI, or reuse the same site-scoping you use elsewhere.

---

## 4. The PO limit — the rule most likely to confuse users

An advance may only draw against the part of the PO that has **not yet been invoiced**:

```
available = po.totalAmount − po.invoicedTotal − (approved advances on this PO)
```

Exceeding it returns **400** with every number spelled out, so surface the message verbatim:

> Advance of ₹60,000 exceeds the remaining PO limit. PO total ₹5,00,000, already invoiced
> ₹3,00,000, already advanced ₹2,00,000 — ₹0 available.

**This is re-checked at approval, not only at create.** Several advances can sit PENDING at once and
each passes its own create-time check in isolation, so an approve can legitimately fail with this
error even though create succeeded. The approve screen must handle a 400 here — it is not a bug.

---

## 5. List and detail

```
GET /advance-payments?page=1&pageSize=20
→ { "records": [ … ], "totalRecords": 57 }
```

Filters (all optional): `siteId[]`, `vendorId[]`, `poId`, `poNumber`, `approvalStatus[]`,
`dateFrom`, `dateTo`, `search` (advance number / vendor advance number / remarks),
`unsettledOnly=true`.
Sorting via `sortField` + `sortOrder`; sortable fields are `advanceNumber`, `advanceDate`, `amount`,
`createdAt`. Pagination via `page` / `pageSize` (`BaseGetDto`).

**The three array filters take one value or many.** `?siteId=<id>` and `?siteId=<a>&siteId=<b>` are
both accepted for `siteId`, `vendorId` and `approvalStatus` — a single value no longer fails with
*"siteId must be an array"*. A malformed uuid is still a 400.

**`poNumber` is its own search**, separate from `search`: partial and case-insensitive on the parent
PO's number, e.g. `?poNumber=PO-003`. It is kept out of `search` on purpose — searching for
everything on a PO should not also match an advance whose remark happens to contain the same digits.
Filters combine as AND, and `totalRecords` reflects them (so pagination does not overshoot).

`GET /advance-payments/:id` returns a single record in the **same shape** as a list row:

```jsonc
{
  "id": "uuid",
  "advanceNumber": "ADV-00042",
  "vendorAdvanceNumber": "ADV/2026/42",
  "poId": "uuid",   "poNumber": "PO-00311",
  "siteId": "uuid", "siteName": "Xyz",
  "vendorId": "uuid", "vendorName": "Lrs Consultant And Engineers",
  "advanceDate": "2026-09-05",
  "amount": 50000,
  "settledAmount": 0,        // moves only when someone settles/unsettles it (§8)
  "balanceAmount": 50000,    // amount − settledAmount, computed server-side
  "isFullySettled": false,
  "settlementCount": 2,
  "settlements": [           // which invoices took how much, oldest first
    { "settlementId": "uuid", "invoiceId": "uuid", "invoiceNumber": "INV-77",
      "invoiceDate": "2026-09-10", "amount": 30000, "settledAt": "2026-09-10T…" }
  ],
  "fileKey": "…", "fileName": "…",
  "remarks": "…",
  "approvalStatus": "pending",   // pending | approved | rejected
  "approvalAt": null,
  "rejectionReason": null,
  "hasBookPayment": false,
  "createdAt": "…",
  "createdByUser": { … },
  "approvalByUser": null
}
```

`balanceAmount` and `isFullySettled` are derived for you — don't recompute them client-side. The
`settlements[]` breakdown is on both the list and the detail (one query for the whole page, so it is
not an extra cost), and `settledAmount` is exactly the sum of its `amount`s.

**One gotcha with `unsettledOnly=true`:** it is applied *after* pagination, in memory. So a page can
come back with fewer rows than `pageSize` while `totalRecords` still reports the unfiltered count.
Don't drive "load more" off `records.length === pageSize` when that filter is on.

---

## 6. Edit and delete

```
PATCH  /advance-payments/:id     → { "message": "Advance payment updated successfully" }
DELETE /advance-payments/:id     → { "message": "Advance payment deleted successfully" }
```

PATCH accepts any subset of: `advanceDate`, `amount`, `vendorAdvanceNumber`, `fileKey`, `fileName`,
`remarks`.

**`poId` cannot be changed** — it is not in the update DTO. Moving an advance to a different PO would
invalidate the headroom it was created under. Delete and recreate instead.

Both are blocked once the advance is frozen, with two distinct messages:

| Condition | Message |
|---|---|
| `hasBookPayment: true` | "…cannot be changed — a book payment already exists against it." |
| `settledAmount > 0` | "…cannot be changed — ₹X has already been settled against invoices." |

Gate the Edit/Delete buttons on `hasBookPayment === false && settledAmount === 0`. Note both are
independent, and **neither depends on approval status** — an *approved* advance is still editable
until money moves.

---

## 7. Approve and reject

```
POST /advance-payments/:id/approve      (no body)
→ { "message": "Advance payment approved successfully" }

POST /advance-payments/:id/reject
{ "reason": "Duplicate of ADV-00039" }   // required, non-empty, ≤2000 chars
→ { "message": "Advance payment rejected successfully" }
```

Neither returns the updated record — **re-fetch** after either call.

| Situation | Result |
|---|---|
| Approve an already-approved advance | 400 "already approved" |
| Approve when PO headroom no longer allows it | 400 with the §4 message |
| Reject an already-rejected advance | 400 "already rejected" |
| Reject with empty/missing reason | 400 "Rejection reason is required." |
| Reject after a booking or settlement exists | 400 (the §6 lock messages) |

A **rejected advance can be approved again** — approve clears `rejectionReason`. Only
already-*approved* is refused. So the reject action is not terminal in the UI.

---

## 8. Settlement — manual, driven from the invoice

> **Changed.** Settlement used to happen by itself when an invoice was approved. It no longer does.
> Approving an invoice settles **nothing**; approving an advance settles **nothing**. An operator
> now decides which advance clears which invoice, and by how much, through the endpoints below.
>
> The reason: automatic settlement only fired at the moment of invoice approval, so the very common
> real sequence — invoice approved first, advance approved a few days later — silently settled
> nothing and left both documents looking wrong with no way to correct them.

All three endpoints live on the **invoice**, and all three require the permission
`financials.advance-payments.settle` (seeded to SUPER_ADMIN, ADMIN, OPERATION_MANAGER).

### Settle

```
POST /site-invoices/:id/advance-settlements
{ "advancePaymentId": "uuid", "amount": 40000 }
```

```jsonc
// 201
{
  "message": "Advance settled against the invoice successfully",
  "settledAmount": 40000,
  "advanceBalanceAfter": 10000,   // advance.amount − advance.settledAmount, after this call
  "invoiceDueAfter": 0            // net payable − advanceSettled − booked, after this call
}
```

Use `advanceBalanceAfter` / `invoiceDueAfter` to refresh both cards without a second fetch.

**Rules, in the order they are checked** — each is a 400 with a message to surface verbatim:

| Condition | Message |
|---|---|
| Invoice is not PURCHASE-side | Advances can only be settled against PURCHASE side invoices. |
| Invoice not APPROVED | The invoice must be approved before an advance can be settled against it. |
| Advance not found / soft-deleted | Advance payment not found. *(404)* |
| Advance not APPROVED | The advance payment must be approved before it can be settled. |
| Advance belongs to another PO | This advance belongs to a different purchase order… |
| Advance already fully settled | Advance {number} is already fully settled. |
| Amount > advance balance | Advance {number} has only {balance} left to settle. You entered {requested}. |
| Invoice has no due left | This invoice has nothing left to settle — its net payable of {netPayable} is already covered by advances and booked payments. |
| Amount > invoice due | Only {due} is due on this invoice. You entered {requested}. |

- **Same PO only.** An advance can only be settled against invoices of its own purchase order.
- **Partial amounts are allowed**, and the same (advance, invoice) pair can be settled more than
  once — ₹60,000 today, ₹40,000 next week. The pair stays **one row** that accumulates to
  ₹1,00,000; reversing it gives back the whole ₹1,00,000, not just the last tranche.
- "Due" is **net payable − already settled − already booked**, where net payable is
  `isGstHold ? taxable − tds : taxable + gst − tds`. An advance is cash to the vendor, so it
  offsets cash the vendor is owed, and it can never overlap money already booked for payment.

### Unsettle one

```
DELETE /site-invoices/:id/advance-settlements/:settlementId
```

```jsonc
// 200
{ "message": "Advance settlement reversed successfully", "releasedAmount": 40000 }
```

### Unsettle all on the invoice

```
DELETE /site-invoices/:id/advance-settlements
```

Same response shape; `releasedAmount` is the total given back. Both return **404
"No settlement found to reverse for this invoice."** when there is nothing to reverse, and a
settlement can only be reversed through *its own* invoice's endpoint — passing a settlement id that
belongs to another invoice is a 404, not a silent success.

### Unlocking an invoice that has settlements

Unlock no longer reverses anything behind the operator's back. Instead **both `unlock-request` and
`unlock-grant` are refused** while any settlement exists:

> This invoice has 1 advance settlement(s) totalling ₹1,00,000.00. Remove them first — unlocking
> would let the amount change while the settlement still points at the old figure.

So the UI flow for editing a settled invoice is: unsettle → unlock → edit → re-approve → settle
again. The requester is told at *request* time, not only at grant time.

`settledAmount`, `balanceAmount` and `isFullySettled` on the advance change only as a result of
these calls, so re-fetch after a settle/unsettle — not after an invoice approval.

### Which advances can I settle against this invoice?

```
GET /advance-payments/dropdown?invoiceId=<invoiceId>      // or ?poId=<poId>
```

Same shape as the PO → JMC, JMC → invoice and invoice → book-payment dropdowns: **every** advance on
the PO comes back, ineligible ones included with `eligible: false` and a reason, so the user sees why
an advance cannot be picked instead of wondering where it went. Ordered oldest advance first.

```jsonc
{
  "invoice": { "id": "uuid", "invoiceNumber": "INV-77", "due": 90000 },   // null when called with poId
  "records": [
    {
      "id": "uuid",
      "label": "ADV/2026/42 — ₹2,00,000.00",
      "eligible": true,
      "reason": null,
      "meta": {
        "advanceNumber": "ADV/2026/42",
        "vendorAdvanceNumber": "…",
        "advanceDate": "2026-09-01",
        "amount": 200000,
        "settledAmount": 0,
        "balanceAmount": 200000,
        "approvalStatus": "APPROVED",
        "poId": "uuid", "poNumber": "PO-00311",
        "vendorName": "Acme Traders",
        "maxSettleableAmount": 90000   // min(balance, invoice due) — null when called with poId
      }
    }
  ]
}
```

- Pass **`invoiceId` alone** on the settle screen: the PO is taken from the invoice, and
  `maxSettleableAmount` is exactly the cap the settle endpoint enforces — use it for the amount
  field's max.
- Pass **`poId` alone** when you are browsing a PO's advances; `invoice` is `null` and
  `maxSettleableAmount` is `null`, since there is no invoice to cap against.
- Passing both is fine when they agree; a `poId` that is not the invoice's PO is a 400.
- Neither → 400. Unknown invoice → 404. Non-uuid → 400.

Reasons you will get back: *"Advance is pending admin approval"*, *"Advance was rejected"*,
*"Advance is fully settled — no balance left"*, and (only with an invoice)
*"Invoice has nothing left to settle — already covered by advances and booked payments"*.

Permission: `financials.advance-payments.view-list`.

### What this means for booking a payment

The book-payment ceiling for an invoice now subtracts what an advance already covered:

```
bookable = invoiceNetPayable − invoice.advanceSettledAmount − already booked
```

An invoice fully covered by an advance cannot be booked at all, and the error says so:

> Invoice net payable of ₹40,000.00 is already fully covered (₹40,000.00 by advance, ₹0.00 booked).
> No further payment can be booked against it.

Surface it verbatim — users will otherwise assume the invoice is unpaid.

### Elsewhere in the app

| Surface | What appears |
|---|---|
| `GET /document-status` | PURCHASE block gains `advance: { unsettledCount, unsettledAmount }` |
| `GET /document-status/issues` | New `overallStatus: "ADVANCE_UNSETTLED"` rows, next action *"Invoice pending against advance paid — ₹X outstanding"*. **These rows are PO-anchored: `chain.jmc` is `null`** and the advance sits at `chain.advance`. Filterable via `overallStatus=ADVANCE_UNSETTLED`. |
| `GET /document-status/po-breakdown` | Each PO gains `advances[]` plus `counts.advance` |
| `GET /billing/site-closing-readiness` | New condition `advances-settled` — **a site cannot close while any approved advance is unsettled** |
| `mv_site_financial_summary` | `advancePaid`, `unsettledAdvance` per PO |
| `mv_universal_financial_view` | `totalAdvancePaid`, `totalUnsettledAdvance` |

`totalPendingBilling` is unchanged and still `invoicedTotal − paidTotal`; advances are reported
beside it, never folded into it, so it stays ≥ 0.

---

## 9. Booking a payment against an advance

An approved advance can be paid out through the normal book-payment → bank-transfer route. Same
endpoint as an invoice booking, with two extra fields:

```
POST /book-payments
```

```jsonc
{
  "sourceType": "ADVANCE",          // omit entirely for the normal invoice flow
  "advancePaymentId": "uuid",       // required when sourceType is ADVANCE
  "bookingDate": "2026-09-05",
  "transferAmount": 40000,
  "remarks": "mobilisation advance release"   // optional
}
```

`invoiceId` is **not** sent for an advance booking, and `siteId` / `poId` / `vendorId` are derived
from the advance. Existing invoice-backed callers need no change at all — omitting `sourceType`
keeps the old behaviour exactly.

| Rule | Behaviour |
|---|---|
| Advance must be **APPROVED** | else 400 "must be approved before a payment can be booked for it" |
| Ceiling is the **advance amount** less what is already booked against it | 400 naming the advance, the booked figure and the remainder |
| Fully booked advance | 400 "already fully booked" |
| Booking **freezes the advance** | `hasBookPayment: true` → edit and delete refused (§6) |
| Deleting every booking **unfreezes** it | `hasBookPayment` returns to `false`, so a mis-booked advance is recoverable |

`settledAmount` plays no part in this ceiling. Settlement is invoices *consuming* the advance;
booking is *releasing the cash* — two independent axes over the same money.

Rollups: only `po.bookedTotal` moves. There is no invoice to roll up onto, and `paidTotal` waits for
the bank transfer, exactly as on the invoice path.

**Deleting a booking needs the unlock workflow.** Book payments are auto-approved and auto-locked on
creation, so `DELETE /book-payments/:id` returns 400 until you run `unlock-request` →
`unlock-grant`. Identical to invoice-backed bookings — not specific to advances.

---

## 10. Error handling summary

All failures are standard `400` / `403` / `404` with a human-readable `message`. Every message is
written to be shown to the user as-is — the PO-limit one in particular contains the exact figures
the user needs. Don't replace them with generic copy.

| Code | When |
|---|---|
| 400 | PO not found / not PURCHASE / not approved; amount ≤ 0; PO limit exceeded; already approved or rejected; missing reject reason; edit/delete after booking or settlement |
| 403 | Caller is not the PM of that site and holds no office role |
| 404 | Advance id does not exist or is deleted |

---

## 11. Suggested build order

1. List + detail (read-only) — everything needed is live.
2. Create form: PO picker → advance number (typed in, required) → amount + date + optional file.
3. Approve / reject actions, both gated on `…approve`, both followed by a re-fetch.
4. Edit / delete, gated on `hasBookPayment === false && settledAmount === 0`.
5. **Settle / unsettle on the invoice screen** (§8), gated on `financials.advance-payments.settle`.
   Populate the advance picker from `GET /advance-payments/dropdown?invoiceId=…`, cap the amount
   field at `meta.maxSettleableAmount`, and re-fetch both the invoice and the advance afterwards.
6. Show `balanceAmount` / `isFullySettled` on the list and detail — they move on settle/unsettle (§8).
7. Surface the new `ADVANCE_UNSETTLED` rows and the `advances-settled` closing condition (§8).

