# Advance Payments — Frontend Integration Guide

Documents what is **actually shipped**, read off the code. The feature is now complete: create,
approve, automatic settlement against invoices (§8), and booking the advance out (§9).

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
| 1 | GET | `/advance-payments/next-number` | `financials.advance-payments.view-list` |
| 2 | POST | `/advance-payments` | `financials.advance-payments.create` |
| 3 | GET | `/advance-payments` | `financials.advance-payments.view-list` |
| 4 | GET | `/advance-payments/:id` | `financials.advance-payments.view-list` |
| 5 | PATCH | `/advance-payments/:id` | `financials.advance-payments.update` |
| 6 | DELETE | `/advance-payments/:id` | `financials.advance-payments.delete` |
| 7 | POST | `/advance-payments/:id/approve` | `financials.advance-payments.approve` |
| 8 | POST | `/advance-payments/:id/reject` | `financials.advance-payments.approve` |

Granted to **SUPER_ADMIN, ADMIN, OPERATION_MANAGER**. Note approve and reject share one permission —
gate both buttons on `…approve`.

---

## 3. Create

### 3.1 Preview the number (optional)

```
GET /advance-payments/next-number
→ { "advanceNumber": "ADV-00042" }
```

Display-only. The number is generated **server-side** on create — never send it in the payload, and
do not assume the previewed value is reserved.

### 3.2 The call

```
POST /advance-payments
```

```jsonc
{
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
201 → { "message": "Advance payment recorded successfully", "id": "uuid", "advanceNumber": "ADV-00042" }
```

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

Filters (all optional): `siteId[]`, `vendorId[]`, `poId`, `approvalStatus[]`, `dateFrom`, `dateTo`,
`search` (advance number / vendor advance number / remarks), `unsettledOnly=true`.
Sorting via `sortField` + `sortOrder`; sortable fields are `advanceNumber`, `advanceDate`, `amount`,
`createdAt`. Pagination via `page` / `pageSize` (`BaseGetDto`).

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
  "settledAmount": 0,        // live — moves when an invoice settles against it (§8)
  "balanceAmount": 50000,    // amount − settledAmount, computed server-side
  "isFullySettled": false,
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

`balanceAmount` and `isFullySettled` are derived for you — don't recompute them client-side.

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

## 8. Settlement — live, and entirely automatic

There is **no settlement endpoint and no settle button**. It happens by itself when a PURCHASE
invoice on the same PO is approved:

```
invoice approved (net payable ₹40,000)  →  oldest advances on that PO consumed first (FIFO)
                                        →  advance.settledAmount += 40,000
                                        →  invoice.advanceSettledAmount = 40,000
```

- **FIFO by `advanceDate`**, then `createdAt`. The oldest money clears first.
- Settlement consumes **net payable** (`isGstHold ? taxable − tds : taxable + gst − tds`), not the
  gross invoice total — an advance is cash to the vendor, so it offsets cash the vendor is owed.
- An advance larger than the invoice carries its balance forward to the next one; it is never split.
- **Unlocking an approved invoice reverses it** — settlement rows are deleted and balances restored.
  Re-approving settles again from scratch against the edited amount.

So `settledAmount`, `balanceAmount` and `isFullySettled` are now **live values that change on their
own**. Poll or re-fetch after an invoice approval; don't cache them.

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
2. Create form: PO picker → `next-number` preview → amount + date + optional file.
3. Approve / reject actions, both gated on `…approve`, both followed by a re-fetch.
4. Edit / delete, gated on `hasBookPayment === false && settledAmount === 0`.
5. Show `balanceAmount` / `isFullySettled` on the list and detail — they move on their own (§8).
6. Surface the new `ADVANCE_UNSETTLED` rows and the `advances-settled` closing condition (§8).

