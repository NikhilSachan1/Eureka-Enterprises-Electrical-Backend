# Release Documentation — Backend Changes

Everything built in this cycle, in one place. Written for two readers:

- **BA / product** — read the *What it does* and *Business rules* under each feature.
- **Frontend** — read *APIs*, *Request / Response*, and *Validation & errors*.

All routes are under `/api/v1` and need the standard h
eaders on every authenticated call:
`Authorization: Bearer <token>`, `X-Active-Role`, `X-Correlation-Id`, `X-Source-Type`,
`X-Client-Type`.

Permission names are checked server-side and **fail closed** — a missing permission is a `403`, so
the FE can safely gate buttons on the same names.

---

## Contents

| # | Feature | FE work needed |
|---|---|---|
| 1 | [Advance Payments](#1-advance-payments) | **Yes — new module** |
| 2 | [Attendance — driver pairing & snapshots](#2-attendance--driver-pairing--snapshots) | **Yes** |
| 3 | [Site–Vendor assignment by Project Manager](#3-sitevendor-assignment-by-project-manager) | **Yes** |
| 4 | [Purchase Orders — line-item unit & config dropdowns](#4-purchase-orders--line-item-unit--config-dropdowns) | **Yes — one breaking change** |
| 5 | [Contractor details in attendance snapshots](#5-contractor-details-in-attendance-snapshots) | No |
| 6 | [Assets — image labels & handover files](#6-assets--image-labels--handover-files) | Optional |
| 7 | [Admin password reset](#7-admin-password-reset) | **Yes** |
| 8 | [Vendor code sequencing](#8-vendor-code-sequencing) | No |
| 9 | [Employee allocation list — field staff only](#9-employee-allocation-list--field-staff-only) | No |
| 10 | [Unlock permission alignment](#10-unlock-permission-alignment) | **Yes — permission rename** |
| 11 | [Scheduled jobs disabled](#11-scheduled-jobs-disabled) | No |
| — | [Breaking changes](#breaking-changes) | — |
| — | [Deployment checklist](#deployment-checklist) | — |

---

# 1. Advance Payments

## What it does

Records money paid to a vendor **before** they have raised any JMC or invoice — mobilisation
advances, part payments against a PO, and so on. Previously there was nowhere in the system to
record this, so such payments either went untracked or were forced through the invoice flow with a
fake invoice.

The full lifecycle: **record → approve → (optionally) pay out → settle automatically against
invoices as they arrive.**

## Business rules

| Rule | Detail |
|---|---|
| Only against an **approved PURCHASE PO** | A pending or rejected PO is refused. PO totals are meaningless until the PO itself is approved. |
| **No tax breakup** | An advance is one final amount. No taxable/GST/TDS split, and nothing enters the GST or TDS registers. |
| **PO headroom** | An advance may only draw against the *uninvoiced* part of the PO: `poTotal − invoicedTotal − approved advances`. |
| Headroom is **re-checked at approval** | Several advances can sit pending at once; each passes its own create-time check in isolation, so one can legitimately fail at approval. |
| Created by the **site's Project Manager** | Office roles (SUPER_ADMIN / ADMIN / MANAGER / OPERATION_MANAGER / HR) bypass. "Project Manager" is a *site allocation* role, not a system role. |
| **Editable only while untouched** | Blocked once a book payment exists or anything has been settled against it. Approval status does not matter — an approved advance is still editable until money moves. |
| The PO it belongs to **cannot be changed** | Delete and recreate instead; moving it would invalidate the headroom it was created under. |
| A rejected advance **can be approved later** | Reject is not terminal. Only *already approved* is refused. |

### Settlement — automatic, no button

When a PURCHASE invoice on the same PO is approved, advances on that PO are consumed
**oldest first (FIFO by advance date)**:

```
invoice approved, net payable ₹40,000
advance A (01 Sep, ₹1,00,000 balance)  →  ₹40,000 taken
                                       →  advance A balance ₹60,000
                                       →  invoice.advanceSettledAmount = ₹40,000
```

- Settlement consumes **net payable** — `isGstHold ? taxable − tds : taxable + gst − tds` — not the
  gross invoice value. An advance is cash to the vendor, so it offsets cash the vendor is owed;
  withheld TDS never reaches them.
- An advance larger than the invoice **carries its balance forward**; it is never split.
- **Unlocking an approved invoice reverses it** — settlements are deleted and balances restored.
  Re-approving settles afresh against the edited amount.

### The double-payment guard

Because an advance has already reached the vendor, the invoice is that much less payable:

```
bookable on an invoice = net payable − advanceSettledAmount − already booked
```

An invoice fully covered by an advance cannot be booked at all.

### Paying an advance out

An approved advance can go through the normal book payment → bank transfer route, capped at the
advance amount less what is already booked. `settledAmount` is **not** part of that cap: settlement
is invoices *consuming* the advance, booking is *releasing the cash* — two independent axes.

## APIs

| Method | Path | Permission |
|---|---|---|
| GET | `/advance-payments/next-number` | `financials.advance-payments.view-list` |
| POST | `/advance-payments` | `financials.advance-payments.create` |
| GET | `/advance-payments` | `financials.advance-payments.view-list` |
| GET | `/advance-payments/:id` | `financials.advance-payments.view-list` |
| PATCH | `/advance-payments/:id` | `financials.advance-payments.update` |
| DELETE | `/advance-payments/:id` | `financials.advance-payments.delete` |
| POST | `/advance-payments/:id/approve` | `financials.advance-payments.approve` |
| POST | `/advance-payments/:id/reject` | `financials.advance-payments.approve` |

Granted to **SUPER_ADMIN, ADMIN, OPERATION_MANAGER**. Approve and reject share one permission.

### Create

```jsonc
POST /advance-payments
{
  "poId": "uuid",                       // required — approved PURCHASE PO
  "advanceDate": "2026-09-05",          // required
  "amount": 50000,                      // required, > 0, max 2 decimals
  "vendorAdvanceNumber": "ADV/2026/42", // optional, ≤100 — the vendor's own reference
  "fileKey": "advance-files/…",         // optional — upload first, send the key
  "fileName": "vendor-proforma.pdf",    // optional, ≤255
  "remarks": "50% mobilisation"         // optional
}

201 → { "message": "Advance payment recorded successfully", "id": "uuid", "advanceNumber": "ADV-10001" }
```

`advanceNumber` is generated server-side — never send it. `siteId` and `vendorId` are derived from
the PO. `GET /advance-payments/next-number` → `{ "advanceNumber": "ADV-10002" }` is a display-only
preview and does not reserve the number.

### List / detail

`GET /advance-payments` → `{ records: [...], totalRecords: n }`

Filters: `siteId[]`, `vendorId[]`, `poId`, `approvalStatus[]`, `dateFrom`, `dateTo`, `search`
(advance number / vendor advance number / remarks), `unsettledOnly=true`.
Sort: `sortField` ∈ `advanceNumber | advanceDate | amount | createdAt`, `sortOrder`.
Paging: `page`, `pageSize`.

```jsonc
{
  "id": "uuid",
  "advanceNumber": "ADV-10001",
  "vendorAdvanceNumber": "ADV/2026/42",
  "poId": "uuid",   "poNumber": "PO-00311",
  "siteId": "uuid", "siteName": "Site A",
  "vendorId": "uuid", "vendorName": "Acme Traders",
  "advanceDate": "2026-09-05",
  "amount": 100000,
  "settledAmount": 40000,      // moves on its own when invoices are approved
  "balanceAmount": 60000,      // amount − settledAmount
  "isFullySettled": false,
  "fileKey": "…", "fileName": "…",
  "remarks": "…",
  "approvalStatus": "PENDING", // PENDING | APPROVED | REJECTED
  "approvalAt": null,
  "rejectionReason": null,
  "hasBookPayment": false,
  "createdAt": "…",
  "createdByUser": { … },
  "approvalByUser": null
}
```

`GET /advance-payments/:id` returns the same shape.

### Edit / delete / approve / reject

```
PATCH  /advance-payments/:id   { advanceDate?, amount?, vendorAdvanceNumber?, fileKey?, fileName?, remarks? }
DELETE /advance-payments/:id
POST   /advance-payments/:id/approve      (no body)
POST   /advance-payments/:id/reject       { "reason": "…" }   // required, ≤2000
```

All four return `{ message }` only — **re-fetch** afterwards.

### Booking an advance out

```jsonc
POST /book-payments
{
  "sourceType": "ADVANCE",        // omit entirely for the normal invoice flow
  "advancePaymentId": "uuid",     // required when sourceType is ADVANCE
  "bookingDate": "2026-09-05",
  "transferAmount": 40000,
  "remarks": "…"                  // optional
}
```

`invoiceId` is not sent. Existing invoice-backed callers need **no change** — omitting `sourceType`
keeps the previous behaviour exactly.

## Validation & errors

| Code | When |
|---|---|
| 400 | PO not found / not PURCHASE / not approved |
| 400 | `amount` ≤ 0 or more than 2 decimals |
| 400 | PO headroom exceeded — message names PO total, invoiced, already advanced, available |
| 400 | Already approved, or already rejected |
| 400 | Reject without a reason |
| 400 | Edit or delete after a booking or settlement exists |
| 400 | Booking: advance not approved / fully booked / over the remaining balance |
| 403 | Caller is not the site's PM and holds no office role |
| 404 | Advance does not exist or is deleted |

Every message is written to be shown to the user unchanged. Example:

> Advance of ₹60,000 exceeds the remaining PO limit. PO total ₹5,00,000, already invoiced
> ₹3,00,000, already advanced ₹2,00,000 — ₹0 available.

> Invoice net payable of ₹40,000.00 is already fully covered (₹40,000.00 by advance, ₹0.00 booked).
> No further payment can be booked against it.

## Where advances show up elsewhere

| Surface | What appears |
|---|---|
| `GET /document-status` | PURCHASE block gains `advance: { unsettledCount, unsettledAmount }` |
| `GET /document-status/issues` | New rows with `overallStatus: "ADVANCE_UNSETTLED"`, next action *"Invoice pending against advance paid — ₹X outstanding"*. **`chain.jmc` is `null`** on these rows; the advance is at `chain.advance`. Filterable via `overallStatus=ADVANCE_UNSETTLED`. |
| `GET /document-status/po-breakdown` | Each PO gains `advances[]` and `counts.advance` |
| `GET /billing/site-closing-readiness` | New condition `advances-settled` — **a site cannot close while any approved advance is unsettled** |
| `mv_site_financial_summary` | `advancePaid`, `unsettledAdvance` per PO |
| `mv_universal_financial_view` | `totalAdvancePaid`, `totalUnsettledAdvance` |

`totalPendingBilling` is unchanged (`invoicedTotal − paidTotal`). Advances are reported beside it,
never folded into it, so it can never go negative.

## Out of scope (deliberately)

SALE-side advances (money received is a different document), a PDF for the advance itself, GST/TDS
on advances, and refund/recovery of an unused advance (the balance carries forward instead).

---

# 2. Attendance — driver pairing & snapshots

## What it does

Drivers work alongside an engineer, and the driver's food allowance is paid to that engineer rather
than to the driver. This release makes that pairing reliable and makes both sides of it visible.

## Business rules

| Rule | Detail |
|---|---|
| The engineer declares the driver | On his own check-in, regularize or force attendance, via `assignmentSnapshot.assignedDrivers`. The driver never declares an engineer. |
| **One driver, one engineer, per day** | Enforced by a unique index. A second engineer claiming the same driver gets a readable error naming the first. |
| One engineer may hold **several drivers** | Fully supported. Each driver's allowance routes to him separately. |
| The driver **inherits the engineer's context** | Site, company, contractors and vehicle are copied onto the driver's own attendance record from the engineer's — a driver has no site context of his own. |
| Inheritance needs the engineer's day to count as worked | `present`, `checkedIn`, `checkedOut`, `halfDay` or `approvalPending`. If his day stops counting, the pairing stops resolving and the allowance returns to the driver. |
| The driver does **not** need to have checked in | As long as he has an attendance row for that date (the midnight job creates one for everyone), his record shows the engineer. |
| A driver marked **non-working cannot stay linked** | Regularize / force / reject to absent, leave, LWP or holiday is refused while an engineer holds him. The error names the engineer. |
| The end-of-day job **unlinks instead of erroring** | A cron has no one to show an error to, so it releases the pairing and re-routes the allowance. |
| Deleting a day follows the same rule | Deleting a claimed driver's attendance is refused; deleting the engineer's releases his drivers. |

## APIs

No new endpoints. Existing ones changed behaviour:

| Method | Path | Change |
|---|---|---|
| POST | `/attendance/action` | `assignmentSnapshot.assignedDrivers` accepted on check-in |
| POST | `/attendance/:attendanceId/regularize` | same, plus the non-working refusal |
| POST | `/attendance/force` | **now honours `assignedDrivers`** (previously ignored — see breaking changes) |
| POST | `/attendance/approval` | reject → absent refuses while a driver is linked |
| DELETE | `/attendance/:attendanceId` | refuses while the person is a linked driver |
| GET | `/attendance` | each record carries `assignedDrivers[]` |
| GET | `/attendance/history` | same |
| GET | `/attendance/current-status` | same |

### Declaring drivers

```jsonc
POST /attendance/force
{
  "userIds": "uuid",                 // a single id or an array
  "attendanceDate": "2026-09-08",
  "status": "present",
  "checkInTime": "09:00",
  "checkOutTime": "18:00",
  "reason": "…", "notes": "…",
  "assignmentSnapshot": {
    "company":   { "id": "…", "name": "…" },
    "contractors": [ { "id": "…", "name": "…" } ],
    "vehicle":   { "id": "…", "registrationNo": "…" },
    "assignedDrivers": ["driver-uuid"]      // DRIVER role only
  }
}
```

**`assignedDrivers` is ignored when `userIds` holds more than one person** — one snapshot applied to
many engineers would have them all claiming the same driver. Claim drivers by forcing one user at a
time, or via regularize.

### Reading the two directions

```jsonc
// engineer's record — derived live from the pairing table
"assignedDrivers": [ { "id": "…", "firstName": "…", "lastName": "…", "employeeId": "…" } ]

// driver's record — stored on the snapshot
"assignmentSnapshot": {
  "assignedEngineer": { "id": "…", "firstName": "…", "lastName": "…", "employeeId": "…" },
  "site": { … }, "company": { … }, "contractors": [ … ], "vehicle": { … }
}
```

## Validation & errors

| Code | Message |
|---|---|
| 400 | `{driver} is assigned as a driver to {engineer} on {date}. Remove the driver from that attendance first, then mark this day as {status}.` |
| 400 | `{driver} is assigned as a driver to {engineer} on {date}. Remove the driver from that attendance first, then delete this day.` |
| 400 | `{driver} is already assigned to {engineer} for {date}. Ask them to release the assignment first.` |
| 400 | Selected user does not hold the DRIVER role |

### How a user fixes a blocked case

| Situation | Action |
|---|---|
| Driver was genuinely absent; the engineer's day is wrong | Regularize the **engineer**, remove the driver, then mark the driver absent |
| The engineer's day is right; the absence is wrong | Regularize the driver to present — he keeps the inherited context |
| Driver on approved leave, claimed by mistake | Regularize the engineer to drop the claim, then apply the leave |
| The cron already marked the driver absent | Nothing to do — it released the link and re-routed automatically |

---

# 3. Site–Vendor assignment by Project Manager

## What it does

Lets the Project Manager of a site manage that site's vendors, instead of every vendor change going
through an admin. PMs can also create vendors, and edit or delete **only the vendors they created**.

## Business rules

| Rule | Detail |
|---|---|
| PM scope is per site | Only sites where the user is **currently allocated** with site role `Project Manager`. |
| Office roles bypass | SUPER_ADMIN, ADMIN, MANAGER, OPERATION_MANAGER, HR get every site. |
| "Project Manager" is **not a system role** | It is `site_allocations.role`. The FE cannot decide this from `user.roles`. |
| Completed sites are excluded | They never appear as assignable, and assignment to one is blocked **for everyone including admins**. Unassigning still works. |
| Vendor edit / delete ownership | A non-office user may edit or delete only vendors where `createdBy` is them. |

## APIs

| Method | Path | Permission |
|---|---|---|
| GET | `/sites/vendors/assignable` | `financials.site-vendors.view` |
| GET | `/sites/:id/vendors` | `financials.site-vendors.view` |
| POST | `/sites/:id/vendors` | `financials.site-vendors.assign` |
| DELETE | `/sites/:id/vendors` | `financials.site-vendors.unassign` |

### Gating the vendor section

```jsonc
GET /sites/vendors/assignable
→ { "allowed": true, "sites": [ { "id": "uuid", "name": "Site A" } ] }
```

- `allowed: false` **or a 403** → hide the vendor section entirely.
- On a site page, show it only if that `siteId` appears in `sites[]`.
- `sites[]` doubles as the site picker.

### Assign / unassign

```jsonc
POST   /sites/:id/vendors     { "vendorIds": ["uuid", "uuid"] }
DELETE /sites/:id/vendors     { "vendorIds": ["uuid"] }
```

Vendor edit/delete buttons: show only when `vendor.createdBy === currentUserId`, or the user holds
an office role. `createdBy` is already on the vendor list response.

## Validation & errors

| Code | When |
|---|---|
| 403 | Not the PM of that site and no office role |
| 400 | Assigning to a `completed` site |
| 400 | Editing or deleting a vendor created by someone else |

---

# 4. Purchase Orders — line-item unit & config dropdowns

## What it does

PO line items can now carry a **unit** (Bag, Kg, Nos …), and the unit and GST-type dropdowns come
from config instead of being hardcoded in the app.

## Business rules

- `unit` is **optional**. Omitting it behaves exactly as before and returns `null`.
- It must be one of the values in the `po_units` config — otherwise `400`.
- Max 20 characters.
- `po_units` is **admin-editable**: units can be added or removed without a release.
- `po_gst_types` is **not** editable (fixed by tax law); it exists so the FE has one place to read
  dropdowns from.
- The unit last used for an item is remembered and offered as the default next time.

## APIs

| Method | Path | Change |
|---|---|---|
| POST | `/purchase-orders` | `items[].unit` accepted |
| PATCH | `/purchase-orders/:id` | `items[].unit` accepted |
| GET | `/purchase-orders`, `/purchase-orders/:id` | `unit` returned on every item |
| GET | `/purchase-orders/items/suggestions` | **response shape changed — see breaking changes** |
| GET | `/purchase-orders/default-items` | `records[]` now include `unit` (may be null) |
| GET | `/configurations/details?key=po_units` | 39 units |
| GET | `/configurations/details?key=po_gst_types` | CGST + SGST, IGST |

```jsonc
"items": [
  { "itemName": "Cement Bag", "quantity": 10,   "rate": 350, "amount": 3500, "unit": "Bag" },
  { "itemName": "Steel Rod",  "quantity": 25.5, "rate": 62,  "amount": 1581, "unit": "Kg"  }
]
```

Both config endpoints return the usual dropdown shape: `[ { "label": "Nos", "value": "Nos" }, … ]`.

The PO PDF gained a **Unit** column.

---

# 5. Contractor details in attendance snapshots

## What it does

Contractors inside an attendance `assignmentSnapshot` now carry `city`, `state` and `gstNumber`
alongside `id` and `name`, so reports and screens can show who the contractor is without a second
lookup.

## Business rules

- The three fields are **read from the contractors master by the server** at the moment the snapshot
  is written — never taken from the client. A GST number is master data with financial meaning and
  must not make a round trip through a mobile app that may have loaded its screen hours earlier.
- Applied on **every** write path: check-in, regularize, force attendance, bulk force.
- A contractor id that no longer exists is kept exactly as sent rather than dropped.
- **No backfill** — attendance rows written before this change keep their two-field contractors.

## APIs

No signature change. Any endpoint returning `assignmentSnapshot` now returns:

```jsonc
"contractors": [
  { "id": "uuid", "name": "Acme Infra", "city": "Delhi", "state": "Delhi", "gstNumber": "07ARWPG9376Q1ZG" }
]
```

`GET /attendance/current-status` also returns the three fields on the live fallback, so the check-in
screen can show them before any snapshot exists.

**FE needs no change** — the fields simply appear. If the app sends them they are accepted and then
overwritten with master values.

---

# 6. Assets — image labels & handover files

## What it does

**Labels:** each asset image can carry a label, so users can tell which photo is which
("front", "serial plate", "damage").

**Handover:** accepting a handover no longer requires photos.

## Business rules

- `assetFileLabels` is an optional array of strings, **index-aligned** with the uploaded files —
  entry *i* labels file *i*.
- Sending more labels than files is an error; sending fewer leaves the rest unlabelled.
- Max 255 characters per label.
- Existing screens that send no labels keep working unchanged.
- Accepting an asset or vehicle handover now works with **no images attached**. Initiating a handover
  and calibration are unchanged — images are still required there.

## APIs

| Method | Path | Change |
|---|---|---|
| POST | `/assets` | `assetFileLabels?: string[]` (multipart, JSON array) |
| PATCH | `/assets/:id` | same |

The asset detail response returns `label` on each image.

---

# 7. Admin password reset

## What it does

Lets an admin set a user's password directly, for staff who cannot complete an email reset link
themselves.

## Business rules

- The target user must hold **only** EMPLOYEE and/or DRIVER roles. An account that also holds ADMIN,
  HR, ACCOUNTS, OPERATION_MANAGER or SUPER_ADMIN **cannot** be reset this way.
- All of that user's refresh tokens are revoked, so existing sessions are logged out.
- The new password is never echoed back, and is masked in audit logs.

## APIs

```
POST /auth/users/:userId/reset-password      permission: employee.reset-password
{ "newPassword": "…", "confirmPassword": "…" }
```

Granted to SUPER_ADMIN, ADMIN, HR, OPERATION_MANAGER.

| Code | When |
|---|---|
| 400 | Passwords do not match, or fail the password policy |
| 400 | Target user holds a privileged role |
| 403 | Caller lacks the permission |
| 404 | User not found |

---

# 8. Vendor code sequencing

## What it does

Vendor codes now start at **10001** instead of 0001, and existing vendors were renumbered to match.

```
before: VEN-0001 … VEN-0019
after:  VEN-10001 … VEN-10018        next new vendor: VEN-10019
```

**No API change.** `GET /vendors` and `GET /vendors/next-code` simply return the new values. The only
FE consideration: do not cache or hardcode vendor codes, and refresh any screen or export still
showing an old `VEN-00xx`.

---

# 9. Employee allocation list — field staff only

## What it does

`GET /site-allocations/employees` previously returned **every active user**, including admins, HR and
accounts staff — because it had no role filter at all. It now returns allocatable field staff.

## Business rules

- A user appears if they hold **EMPLOYEE or DRIVER and nothing else**.
- Anyone holding an office role (ADMIN, HR, ACCOUNTS, OPERATION_MANAGER, SUPER_ADMIN) is excluded —
  **unless they are currently allocated to a site**, in which case they stay visible so a real
  allocation never silently disappears and the Free/Allocated stats keep reconciling.
- A user with no roles at all is excluded.
- The global stats (`total` / `allocated` / `free`) count the same population as the rows.

No request or response shape change; `allocatedStatus`, `search`, `siteId`, `siteName`, sorting and
paging all behave as before.

---

# 10. Unlock permission alignment

## What it does

Book payments and site reports now use the same permission name for granting an unlock as JMCs,
purchase orders and invoices already did.

| Endpoint | Before | After |
|---|---|---|
| `POST /book-payments/:id/unlock-grant` | `financials.book-payments.unlock-grant` | **`financials.book-payments.unlock`** |
| `POST /book-payments/:id/unlock-reject` | `financials.book-payments.unlock-request-reject` | **`financials.book-payments.unlock`** |
| `POST /site-reports/:id/unlock-grant` | `financials.site-reports.unlock-grant` | **`financials.site-reports.unlock`** |
| `POST /site-reports/:id/unlock-reject` | `financials.site-reports.unlock-request-reject` | **`financials.site-reports.unlock`** |

`unlock-request` is unchanged — it remains `<module>.update` in all five modules.

Both new permissions are granted to **ADMIN, OPERATION_MANAGER, SUPER_ADMIN**, matching JMC. Note the
practical effect: **OPERATION_MANAGER can now grant an unlock on book payments and site reports**,
where previously only ADMIN and SUPER_ADMIN could. That is deliberate — it makes all five modules
behave identically — but it does mean an OM can grant their own unlock request, exactly as they
already could on JMCs, POs and invoices.

## Reminder: how the unlock workflow works

Book payments are **auto-approved and auto-locked** the moment they are created. To edit or delete
one:

1. `POST /book-payments/:id/unlock-request` `{ "reason": "…" }` — permission `…update`
2. `POST /book-payments/:id/unlock-grant` — permission `…unlock`
3. `PATCH` or `DELETE` the record

Editing re-approves and re-locks automatically, so a second edit needs a fresh unlock. A booking with
a bank transfer against it can never be unlocked.

---

# 11. Scheduled jobs disabled

Three scheduled jobs were switched off at the request of the business:

- Monthly payroll generation
- Monthly auto-approval of leave
- Monthly auto-approval of attendance

They are commented out rather than deleted, so re-enabling is a one-line change. No API impact.

---

# Breaking changes

Three, all on the FE side.

### 1. `GET /purchase-orders/items/suggestions` — response shape

```jsonc
// before
{ "records": ["Cement", "Steel Rod"] }                       // string[]

// after
{ "records": [ { "name": "Cement", "unit": "Bag" } ] }       // objects
```

`unit` is the unit last used for that item, so it can pre-fill the line; it may be `null`.

### 2. `GET /document-status/issues` — `chain.jmc` can be null

Advance rows are PO-anchored and have no JMC. Any code doing `row.chain.jmc.number` without a guard
will break. Those rows carry `chain.advance` instead.

Also on that endpoint: `totalRecords` is now the count **after** the status filter is applied. It
previously counted pre-filter rows, which made pagination overshoot.

### 3. Unlock permission names

See [§10](#10-unlock-permission-alignment). Any FE gating on `…unlock-grant` or
`…unlock-request-reject` for book payments or site reports must switch to `…unlock`.

**Deploy order matters:** the permission guard fails closed, so if the code ships before the
migration runs, nobody can grant or reject an unlock on those two modules.

---

# Deployment checklist

### Migrations (run before or with the deploy)

| # | What it does |
|---|---|
| `…056` | Backfills `asset_event_types` config |
| `…057` | Creates `advance_payments` |
| `…058` | Creates `advance_settlements` |
| `…059` | Seeds the advance-number config |
| `…060` | Seeds advance-payment permissions |
| `…061` | `book_payments`: nullable `invoiceId`, `sourceType`, `advancePaymentId` + source CHECK |
| `…062` | Seeds `financials.book-payments.unlock` and `financials.site-reports.unlock` |
| `…063` | `site_invoices.advanceSettledAmount` |
| `…064` | `purchase_orders.advancePaidTotal` (**with backfill** of existing approved advances) |
| `…065` | Recreates both financial materialized views with the advance columns |

Earlier migrations in this cycle also cover PO item `unit` columns, the `po_units` and
`po_gst_types` configs, vendor code renumbering, and the `employee.reset-password` permission.

**`…065` drops and recreates `mv_site_financial_summary` and `mv_universal_financial_view`.** Run it
in a quiet window — the views are empty until the refresh job next runs (every 5 minutes), so any
dashboard reading them will show zeros in between.

### New permissions to assign

| Permission | Roles |
|---|---|
| `financials.advance-payments.{view-list,create,update,delete,approve}` | SUPER_ADMIN, ADMIN, OPERATION_MANAGER |
| `financials.book-payments.unlock` | SUPER_ADMIN, ADMIN, OPERATION_MANAGER |
| `financials.site-reports.unlock` | SUPER_ADMIN, ADMIN, OPERATION_MANAGER |
| `employee.reset-password` | SUPER_ADMIN, ADMIN, HR, OPERATION_MANAGER |

All are seeded by the migrations above; the table is for the BA's reference.

### Config to verify after deploy

`po_units` (39 values), `po_gst_types` (CGST + SGST, IGST), `advance_number_config`
(`{ prefix, padLength, startFrom }`), `asset_event_types`.

---

# Known gaps

Carried deliberately, not oversights:

| Item | Status |
|---|---|
| `PATCH /sites/:id` with `vendorIds: null` returns **500** | Open. Send `[]` to clear vendors; omitting the key means "don't touch". Fix pending a decision. |
| Sites with status `work_completed` are still assignable for vendors | Open — only `completed` is excluded today. |
| Old asset images linked to a superseded version | Not backfilled; new updates behave correctly. |
| Advance payments: SALE side, advance PDF, GST/TDS on advances, refund of an unused advance | Out of scope by design. |
| Attendance: engineer's day never approved → driver approval behaviour; night shifts crossing midnight | Parked pending a business decision. |
