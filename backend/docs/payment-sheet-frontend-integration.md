# Payment Sheet — Frontend Integration Guide

> Audience: frontend team. Base path: `/api/v1`. All examples use that prefix.
> Companion design doc: `docs/payment-sheet-spec.md`.

A **Payment Sheet** batches money owed to employees (expense + fuel reimbursements) and
vendors (book-payment payouts) into one document that moves through a configurable approval
chain and ends with an accountant disbursing each line. This guide covers everything needed
to build the UI against the API.

---

## 1. Auth & required headers

Every request (except login) needs the JWT **and** these headers — they are enforced
globally:

| Header | Value | Notes |
|---|---|---|
| `Authorization` | `Bearer <accessToken>` | from `POST /auth/sign-in` |
| `X-Active-Role` | the user's current role, e.g. `OPERATION_MANAGER` | must be one of the user's assigned roles |
| `X-Correlation-Id` | **a UUID** | ⚠️ must be a valid UUID v4 — a non-UUID value causes a request-audit failure (HTTP 500). Generate one per request. |
| `X-Source-Type` | `web` | any non-empty string |
| `X-Client-Type` | `web` | any non-empty string |

Login:
```
POST /auth/sign-in
{ "email": "...", "password": "..." }
→ 201 { "accessToken", "refreshToken", "roles": [...], "activeRole", "userId", ... }
```

---

## 2. Roles & who can do what

Roles in the chain (default config): `OPERATION_MANAGER` → `HR` → `ADMIN` → `ACCOUNTANT`
(plus `SUPER_ADMIN`, who can act at any stage). The chain is **DB-configurable** (see §9), so
treat stage→role as data, not hard-coded.

| Capability | Role (default flow) |
|---|---|
| Create / edit draft / submit | OPERATION_MANAGER |
| Review: edit amount (free), forward, return, reject | HR |
| Admin: decrease amount, add/remove beneficiaries, forward, return, reject | ADMIN |
| Process: pay / hold / release / reject each line | ACCOUNTANT |

Permission names (for menu/visibility gating on the FE): `financials.payment-sheets.{create,
review, admin-review, process, view, download}`. **Important:** the API authorizes *workflow
actions* by the sheet's **current stage vs. the user's active role** (enforced server-side),
not purely by permission. So the same `/forward` endpoint serves HR and ADMIN; the server
decides if the caller owns the current stage. Use the user's role + the sheet's `currentStage`
to decide which buttons to show.

---

## 3. Status & stage model

**Sheet `status`** (header lifecycle):
`DRAFT → SUBMITTED → IN_REVIEW → PROCESSING → COMPLETED`, plus `RETURNED`, `REJECTED`, `CANCELLED`.

**`currentStage`** (fine-grained position; drives which role can act):
`INITIATION → HR_REVIEW → ADMIN_REVIEW → PROCESSING` (null when terminal). Stage keys come
from the approval-flow config, so render labels from the sheet, don't hard-code.

**Item `itemStatus`** (accountant level): `PENDING → PAID | HOLD | REJECTED`.

A sheet auto-moves to `COMPLETED` when every item is `PAID`/`REJECTED` (no item left `HOLD`/`PENDING`).

---

## 4. Building the picker (where beneficiaries come from)

The "select users/vendors to pay" screen is populated from the **existing** pending-settlement
endpoints (not part of this module):

- Employees with expense pending: `GET /expenses/pending-settlement`
- Employees with fuel pending: `GET /fuel-expenses/pending-settlement`
- Vendors with payable book payments: `GET /book-payments/vendor-list`

Each returns the beneficiary, their pending amount, and bank details. For a **vendor**, the
selectable unit is a **book payment** (the line is backed by one or more book-payment ids).

---

## 5. Endpoint reference

### 5.1 Create a sheet (DRAFT)
```
POST /payment-sheets        (perm: create)
{
  "title": "June 2026 settlement",          // optional
  "remarks": "...",                          // optional
  "items": [
    { "beneficiaryType": "USER", "userId": "<uuid>", "sourceType": "EXPENSE",      "requestedAmount": 5000 },
    { "beneficiaryType": "USER", "userId": "<uuid>", "sourceType": "FUEL_EXPENSE", "requestedAmount": 3000 },
    { "beneficiaryType": "VENDOR", "vendorId": "<uuid>", "sourceType": "VENDOR_PAYMENT",
      "requestedAmount": 500, "bookPaymentIds": ["<uuid>"] }
  ]
}
→ 201 { "message": "Payment sheet created successfully", "id": "<uuid>", "sheetNumber": "PS/2627/0005" }
```
Rules enforced on create:
- USER item: `requestedAmount` must be `> 0` and `≤ live pending` for that user+source.
- VENDOR item: `requestedAmount` **must equal the sum** of the selected book payments'
  transferable amounts (vendor lines are allocation-based). Book payments must be APPROVED and
  not yet transferred.
- A `(beneficiary, sourceType)` pair can appear only once per sheet.

### 5.2 List
```
GET /payment-sheets?status=&currentStage=&financialYear=&page=1&pageSize=10&sortOrder=DESC   (perm: view)
→ 200 { "records": [ { id, sheetNumber, title, status, currentStage, totalRequestedAmount,
                       totalCurrentAmount, totalPaidAmount, financialYear, createdAt, ... } ],
        "totalRecords": 42 }
```

### 5.3 Detail (items + history + stage logs)
```
GET /payment-sheets/:id        (perm: view)
→ 200 {
  id, sheetNumber, title, remarks, financialYear,
  status, currentStage,
  totalRequestedAmount, totalCurrentAmount, totalPaidAmount, pdfKey,
  items: [{
    id, beneficiaryType, userId, vendorId, sourceType,
    pendingSnapshot, requestedAmount, currentAmount,
    bankSnapshot: { accountHolderName, bankName, accountNumber, ifscCode } | null,
    itemStatus, paidAmount, paidAt, paymentRef, holdReason, heldBy, rejectReason,
    bookPaymentAllocations: [{ id, bookPaymentId, allocatedAmount, bankTransferId }],

    // Settlement breakdown (added for the "actual due vs payable vs remaining" ask):
    actualDueAmount,   // outstanding balance independent of this sheet
    payableAmount,     // what this line pays out (== currentAmount)
    remainingAmount,   // actualDueAmount − payableAmount, what stays due after this payment
    invoices: [{       // VENDOR items only — one entry per allocated book payment/invoice
      invoiceId, invoiceNumber, invoiceDate,
      actualDueAmount, payableAmount, remainingAmount,
      companyName, projectName, city, state
    }]
    // Expense/fuel items get actualDueAmount/payableAmount/remainingAmount only —
    // no `invoices` array, no company/project/city/state (no single site to attach it to).
  }],
  stageLogs: [{ fromStage, toStage, action, actedBy, actedRole, remarks, createdAt }],
  history:   [{ itemId, action, previousAmount, newAmount, reason, stage, createdBy, createdAt }]
}
```

### 5.4 Edit draft meta
```
PATCH /payment-sheets/:id      (perm: create; only when DRAFT or RETURNED)
{ "title": "...", "remarks": "..." }
```

### 5.5 Items — add / edit amount / remove
```
POST   /payment-sheets/:id/items                 (perm: view; initiator in DRAFT, or ADMIN at ADMIN_REVIEW)
       { "items": [ <same item shape as create> ] }

PATCH  /payment-sheets/:id/items/:itemId         (perm: view; HR free-edit, ADMIN decrease-only)
       { "amount": 4000, "reason": "Admin trim" }   // reason required at ADMIN_REVIEW

DELETE /payment-sheets/:id/items/:itemId         (perm: view; initiator in DRAFT, or ADMIN with reason)
       { "reason": "Not approved this cycle" }
```
Amount-edit rules (server-enforced):
- HR (`amountEdit: free`): any value `≤ live pending`.
- ADMIN (`amountEdit: decrease-only`): **cannot increase** beyond current amount; `reason` required.
- **Vendor items can't be amount-edited** directly (they're allocation-based) — to reduce a
  vendor payout, remove the line and re-add it with fewer book payments.

### 5.6 Workflow transitions
```
POST /payment-sheets/:id/submit    (perm: create; DRAFT/RETURNED → enters chain)   { "reason"?: "" }
POST /payment-sheets/:id/forward   (perm: view; current-stage owner → next stage)  { "reason"?: "" }
POST /payment-sheets/:id/return    (perm: view; HR/ADMIN → back to initiator)       { "reason": "..." }  // required
POST /payment-sheets/:id/reject    (perm: view; HR/ADMIN → terminal REJECTED)       { "reason": "..." }  // required
→ 200/201 { "message": "..." }
```
The server rejects the call (403/400) if the caller's active role doesn't own `currentStage`.

### 5.7 Accountant processing (at PROCESSING stage)
```
POST /payment-sheets/:id/items/:itemId/pay        (perm: process)
  // EXPENSE item:
  { "paymentMode": "upi", "category": "tools", "paidDate": "2026-06-24", "description"?: "..." }
  // FUEL_EXPENSE item:
  { "paymentMode": "cash", "paidDate": "2026-06-24", "description"?: "..." }
  // VENDOR item (one transfer per allocated book payment):
  { "transfers": [ { "bookPaymentId": "<uuid>", "utrNumber": "UTR...", "transferDate": "2026-06-24",
                     "proofFileKey"?: "...", "proofFileName"?: "..." } ], "remarks"?: "..." }
→ 201 { "message": "Item marked as paid", "paymentRef": "<credit-traceRef | bankTransferId(s)>" }

POST /payment-sheets/:id/items/:itemId/hold       (perm: process)  { "reason": "..." }   // required
POST /payment-sheets/:id/items/:itemId/release    (perm: process)  // only the accountant who held it
POST /payment-sheets/:id/items/:itemId/reject     (perm: process)  { "reason": "..." }   // required
```
Paying performs the real settlement:
- EXPENSE/FUEL → writes an approved `credit` entry in that ledger (pending drops).
- VENDOR → creates the bank transfer(s) (+ auto payment-advice); book payment flips `hasTransfer`.

`category` is **required** for EXPENSE pays and must be a valid expense category;
`paymentMode` must be a valid mode. `paidDate` cannot be in the future.

### 5.8 Reconcile (live pending vs sheet)
```
GET /payment-sheets/:id/reconcile     (perm: view)
→ 200 {
  sheetId, sheetNumber, status,
  lines: [{ itemId, beneficiaryType, userId, vendorId, sourceType, itemStatus,
            pendingSnapshot, currentAmount, livePending, difference, conflict }]
}
```
Call this before/while reviewing or paying. `conflict: true` means `currentAmount > livePending`
(the beneficiary's pending dropped since the sheet was built — paying would overpay). Surface a
warning and let the reviewer reduce the amount. Pay-time re-checks this and returns
`400 "Live pending is now lower…"` if violated.

### 5.9 PDF download (with optional filter)
```
GET /payment-sheets/:id/pdf                              (perm: download) → full sheet
GET /payment-sheets/:id/pdf?sourceType=VENDOR_PAYMENT                    → vendor lines only
GET /payment-sheets/:id/pdf?sourceType=EXPENSE|FUEL_EXPENSE              → that source only
GET /payment-sheets/:id/pdf?beneficiaryType=USER|VENDOR                  → that beneficiary type
GET /payment-sheets/:id/pdf?beneficiaryType=VENDOR&sourceType=VENDOR_PAYMENT   → combine
→ 200 { "url": "<presigned S3 url, ~15 min>", "key": "payment-sheets/<fy>/<sheetNo>[-filter].pdf" }
```
Open `url` in a new tab to view/download. The URL expires (~15 min) — re-call to get a fresh one.
Invalid filter → `400`; filter matching no lines → `400`.

---

## 6. Enums (use these exact string values)

```
beneficiaryType : "USER" | "VENDOR"
sourceType      : "EXPENSE" | "FUEL_EXPENSE" | "VENDOR_PAYMENT"
status          : "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "PROCESSING" | "COMPLETED" | "RETURNED" | "REJECTED" | "CANCELLED"
currentStage    : "INITIATION" | "HR_REVIEW" | "ADMIN_REVIEW" | "PROCESSING" | null
itemStatus      : "PENDING" | "PAID" | "HOLD" | "REJECTED"
```

---

## 7. Suggested UI flows by role

- **Operation Manager:** picker → create DRAFT → review reconcile → `submit`. Can edit/remove
  items and `PATCH` meta while `DRAFT`/`RETURNED`.
- **HR:** open sheets at `HR_REVIEW` → adjust amounts (free) → `forward` / `return` / `reject`.
- **Admin:** sheets at `ADMIN_REVIEW` → `decrease` amounts (reason), add/remove beneficiaries →
  `forward` (to accountant) / `return` / `reject`.
- **Accountant:** sheets at `PROCESSING` → per line `pay` / `hold` / `release` / `reject`.
  Sheet flips to `COMPLETED` automatically when all lines are resolved.

Drive button visibility from `(user.activeRole, sheet.currentStage, item.itemStatus)`.

---

## 8. Error handling

Errors use the platform's envelope:
```json
{ "error": { "code": 400, "message": "Amount can only be decreased at this stage", "path": "...", "method": "..." } }
```
Common ones to handle: `400` amount > pending / increase-not-allowed / reason-required /
vendor amount mismatch / pending-conflict; `403` not the current-stage owner; `404` sheet/item
not found. Show `error.message` to the user.

---

## 9. Configurability (FYI, not a FE concern)

The approval chain (stages, roles, edit policies) lives in DB config (`payments.approval_flow`)
and can change without a deploy. **Do not hard-code the stage order or stage→role mapping** —
read `currentStage` from the sheet and decide actions from the user's role + server responses.

---

## 10. Gotchas checklist

- ✅ Send a **UUID** `X-Correlation-Id` on every call.
- ✅ Vendor line amount = Σ of selected book payments (no partial); reduce by removing the line.
- ✅ Re-fetch `/reconcile` before paying; respect `conflict`.
- ✅ EXPENSE pay requires a valid `category`; all pays need a valid `paymentMode` and non-future `paidDate`.
- ✅ PDF `url` is short-lived — fetch on demand.
- ✅ Decide buttons from `currentStage` + active role, not from permissions alone.
