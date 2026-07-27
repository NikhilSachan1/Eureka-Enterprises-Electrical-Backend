# PO (System-Generated) + Payment Request — Frontend Integration Guide

Everything the FE needs to integrate: flows, endpoints, request/response shapes, validations,
button-gating, and error handling.

- Base path examples below omit the API prefix (`/api/v1`).
- Auth: JWT + standard headers (`X-Active-Role`, `X-Correlation-Id`, `X-Client-Type`,
  `X-Source-Type`) — same as everywhere.
- All amounts are numbers (INR). Dates are ISO (`YYYY-MM-DD`).

---

## 1. Big picture — what changed

- A PO can now be **system-generated** in-app (line items → auto number → approve → download PDF).
  **No file upload** for system-generated POs.
- **Who can create is site-scoped** (differs by project type). Use the `can-create` endpoint to
  **show/hide the Create PO button**.
- New **Payment Request** flow: raise a request against an invoice → office approves (can adjust the
  amount) → a book payment is auto-created (shows in the payment sheet).
- **JMC & Invoice creation are now also site-scoped** — the creator must be allocated to that site.

---

## 2. Create a system-generated PO

### 2.1 Gate the "Create PO" button
`GET /purchase-orders/can-create?siteId=<siteId>`
```json
{ "allowed": true,  "reason": null }
{ "allowed": false, "reason": "Civil site: only the site Project Manager can create this document." }
{ "allowed": false, "reason": "You are not allocated to this site." }
```
Show the button only when `allowed === true`; else disable and show `reason` as a tooltip.

> Rule: **Civil** site → only the site's **Project Manager**; **Electrical-only** site → any user
> allocated to the site.

### 2.2 Pre-fill default items (optional)
`GET /purchase-orders/default-items`
```json
{ "records": [ { "itemName": "Sample Item (replace me)", "hsnCode": null, "make": null } ] }
```
Use to seed the empty item grid on a new PO. User can add/remove rows.

### 2.3 Item name typeahead
`GET /purchase-orders/items/suggestions?search=cem&limit=20`
```json
{ "records": ["Cement OPC 53", "Cement PPC"] }
```

### 2.4 Create
`POST /purchase-orders`
```jsonc
{
  "siteId": "uuid",            // required
  "partyType": "PURCHASE",     // required — system-generated PO is PURCHASE (vendor) only
  "vendorId": "uuid",          // required for PURCHASE
  "poDate": "2026-07-27",      // required
  "gstPercentage": 18,          // optional — drives GST
  "gstType": "CGST_SGST",       // optional: "CGST_SGST" (default) | "IGST"
  "remarks": "optional",
  "items": [                    // required for system-generated PO
    { "itemName": "Cement OPC 53", "hsnCode": "2523", "make": "UltraTech", "quantity": 100, "rate": 350, "amount": 35000 },
    { "itemName": "TMT Steel Fe500", "hsnCode": "7214", "make": "TATA", "quantity": 2, "rate": 55000, "amount": 110000 }
  ]
}
```
Response:
```json
{ "message": "Purchase order created successfully", "id": "uuid", "poNumber": "PO/2627/0001" }
```
**FE notes:**
- **Do NOT send** `poNumber` (auto-generated `PO/{FY}/{seq}`), `fileKey`/`fileName` (no upload), or
  `taxableAmount`/`totalAmount` (computed server-side from items).
- `amount` per line = `quantity × rate` (compute on FE for display; backend re-computes the totals).
- Totals the backend derives: `taxable = Σ amount`, `gst = taxable × gstPercentage/100`,
  `total = taxable + gst`.

### 2.5 Edit items (before approval)
`PATCH /purchase-orders/:id`
```jsonc
{ "items": [ { "itemName": "…", "hsnCode": "…", "make": "…", "quantity": 10, "rate": 100, "amount": 1000 } ] }
```
- **Replace strategy**: send the **full** remaining item list (removed rows simply omitted). Backend
  recomputes amounts.
- Allowed only while `approvalStatus === "PENDING"` and not locked.

### 2.6 Approve / download PDF
- Approve via the existing `POST /purchase-orders/:id/approve`.
- `GET /purchase-orders/:id/pdf` → `{ "url": "<presigned>", "key": "..." }` → open/download `url`.
  - Regenerated fresh each call. **Show the Download button only when `approvalStatus === "APPROVED"`**
    (gating is on the FE).
  - PDF shows CGST/SGST (if `gstType=CGST_SGST`) or a single IGST line (if `IGST`).

### 2.7 Detail / list
`GET /purchase-orders/:id` now includes: `items[]`, `isSystemGenerated`, `gstType`, `taxableAmount`,
`gstAmount`, `totalAmount`, `approvalStatus`, `isLocked`. List `GET /purchase-orders` unchanged.

---

## 3. Payment Request flow

### 3.1 Raise
`POST /payment-requests`
```json
{ "invoiceId": "uuid", "requestedAmount": 20000, "reason": "Site materials payment" }
```
→ `{ "message": "Payment request submitted successfully", "id": "uuid" }`  (status = `PENDING`).
Site/PO are derived from the invoice — FE only sends `invoiceId`.

### 3.2 Approve (office) — can adjust the amount
`POST /payment-requests/:id/approve`
```json
{ "approvedAmount": 18000, "remarks": "approved partial" }
```
- Omit `approvedAmount` to approve the requested amount as-is.
- On approval a **book payment is created** for the approved amount → it appears in the payment sheet.
- Response: `{ "message": "Payment request approved — book payment created", "bookPaymentId": "uuid" }`.

### 3.3 Reject
`POST /payment-requests/:id/reject` → `{ "reason": "not needed" }`

### 3.4 List / detail
`GET /payment-requests?siteId[]=&invoiceId=&status=PENDING&page=1&pageSize=10`
`GET /payment-requests/:id` → includes `invoice`, `status`, `requestedAmount`, `approvedAmount`,
`bookPaymentId`, `approvalByUser`, `rejectionReason`.

> Only a **PENDING** request can be approved/rejected. After that it's terminal — hide the
> approve/reject actions once `status !== "PENDING"`.

---

## 4. JMC & Invoice — site-scoping (behaviour change)

Creating a **JMC** or an **Invoice** now requires the user to be **allocated to that site** (team or
PM). A non-allocated user gets:
```json
// 403
{ "message": "You are not allocated to this site." }
```
FE: handle 403 on JMC/Invoice create gracefully (e.g., disable create for sites the user isn't on).
There is no separate `can-create` endpoint for JMC/Invoice — gate by the user's site allocations, or
just handle the 403.

---

## 5. Validation reference (mirror these on the FE)

### Create PO
| Field | Rule |
|---|---|
| `siteId` | required, UUID |
| `partyType` | required; use `PURCHASE` for system-generated |
| `vendorId` | required (PURCHASE) |
| `poDate` | required, ISO date |
| `items` | required (system-gen), ≤500 rows |
| `items[].itemName` | required, ≤255 |
| `items[].hsnCode` | optional, ≤20 |
| `items[].make` | optional, ≤255 |
| `items[].quantity` | required, number ≥ 0 (≤3 decimals) |
| `items[].rate` | required, number ≥ 0 (≤2 decimals) |
| `items[].amount` | required, number ≥ 0 (≤2 decimals) = quantity × rate |
| `gstPercentage` | optional, number ≥ 0 |
| `gstType` | optional, `CGST_SGST` \| `IGST` |
| `remarks` | optional |

### Payment Request
| DTO | Field | Rule |
|---|---|---|
| Create | `invoiceId` | required, UUID |
| | `requestedAmount` | required, number ≥ 0.01 (≤2 decimals) |
| | `reason` | optional |
| Approve | `approvedAmount` | optional, number ≥ 0.01 (defaults to requested) |
| | `remarks` | optional |
| Reject | `reason` | required |

---

## 6. Error / status handling

| Status | When | Message (example) | FE action |
|---|---|---|---|
| 403 | Not allowed to create for this site | `You are not allocated to this site.` / `Civil site: only the site Project Manager…` | Disable create; show reason |
| 400 | Items sent for a non-PURCHASE PO | `Line items (system-generated PO) are for PURCHASE (vendor) only.` | Fix party type |
| 400 | Edit/delete after PENDING or when locked | `Document can only be deleted while in PENDING state.` / locked message | Hide edit/delete |
| 400 | PDF for a non system-generated PO | `PDF is available only for system-generated POs with items.` | Hide PDF for upload-only POs |
| 400 | Approve/reject a non-PENDING payment request | `Only a PENDING payment request can be actioned.` | Hide actions once actioned |
| 409 | Duplicate PO number | `PO number already exists for this site/party combination` | (rare — number is auto) |
| 404 | Not found | `… not found` | — |

---

## 7. UI gating cheat-sheet
- **Create PO button** → `can-create?siteId=` → `allowed`.
- **Edit / Delete PO** → only when `approvalStatus === "PENDING"` && `isLocked === false`.
- **Download PO PDF** → only when `approvalStatus === "APPROVED"`; call `/:id/pdf` and open `url`.
- **Rejected doc** → terminal: no approve/edit/delete (create a new one).
- **Payment Request approve/reject** → only when `status === "PENDING"`.
- **Item name field** → wire to `/items/suggestions?search=` for typeahead.

---

## 8. Permissions (backend-gated; FE also hides accordingly)
- PO: `financials.purchase-orders.{create,view-list,update,delete,approve,unlock}`
- Payment Request: `financials.payment-requests.{create,view-list,approve}`
- Reads share `view-list`; approve+reject share `approve`.
Until a permission is granted to your role you'll get 403 — coordinate role grants with the admin.
