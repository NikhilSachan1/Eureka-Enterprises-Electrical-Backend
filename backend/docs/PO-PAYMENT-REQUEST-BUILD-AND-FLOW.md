# PO (System-Generated) + Site-Scoped Auth + Payment Request — Build, Flow & Validations

> Complete reference for everything built in this arc. Covers the System-Generated PO, the
> site-scoped create authorization (PO / JMC / Invoice), and the Payment Request module.
> All items are implemented and tested on dev; not yet deployed to UAT/prod.

---

## 1. What was built (summary)

| # | Feature | Status |
|---|---|---|
| 1 | **System-generated PO** — line items, auto number, computed amounts, branded PDF | ✅ built + tested |
| 2 | **Site-scoped create auth** — PO (Civil→PM / Electrical→team), JMC + Invoice (any allocated) | ✅ built + tested |
| 3 | **PO item suggestions** (typeahead) + **default items** | ✅ built + tested |
| 4 | **Payment Request** module — request → approve (adjust) → auto book-payment | ✅ built + tested |
| 5 | **Vendor "add by PM"** | permission-only (no code) |
| 6 | **Material consumption / remaining stock** | future (data model forward-compatible) |

Reused pattern: JMC system-generated enhancement (line-items table + auto-number + branded PDF).

---

## 2. Data model changes

### Altered — `purchase_orders`
- `fileKey`, `fileName` → **nullable** (system-generated PO has no upload).
- `isSystemGenerated` boolean (default false) — true when created with line items.
- `gstType` varchar(10) (default `CGST_SGST`) — `CGST_SGST` | `IGST` (PDF tax split).

### New tables
- **`po_items`** — poId (FK, cascade), itemName, hsnCode?, make?, quantity numeric(15,3), rate numeric(15,2), amount numeric(15,2), sortOrder.
- **`po_item_masters`** — global PO item-name suggestions (case-insensitive unique on `LOWER(name)`).
- **`po_default_items`** — default line items to pre-fill a new PO (seeded with 1 placeholder; not editable via API).
- **`payment_requests`** — invoiceId (FK, cascade), siteId, poId (denormalized), requestedAmount, approvedAmount?, status (PENDING/APPROVED/REJECTED), reason?, bookPaymentId?, approvalBy?, approvalAt?, rejectionReason?.

### Migrations
`1860000000032` … `1860000000037`:
32 alter PO · 33 po_items · 34 po_item_masters · 35 po_default_items (+seed) · 36 payment_requests · 37 payment-request permissions.

---

## 3. Flows

### 3.1 System-generated PO
```
Site-allocated user (PM for Civil / any for Electrical)
  → POST /purchase-orders  { siteId, partyType:PURCHASE, vendorId, poDate, items[], gstPercentage, gstType }
      • site-scoped auth check (403 if not allowed)
      • auto PO number  PO/{FY}/{seq}
      • amounts computed server-side: taxable = Σ item.amount; gst = taxable×gst% ; total = taxable+gst
      • PO(isSystemGenerated=true, fileKey=null) + po_items inserted (one transaction)
      • item names upserted into po_item_masters
  → (edit while PENDING via PATCH — items replace + amounts recompute)
  → office approves  → APPROVED + locked
  → GET /purchase-orders/:id/pdf  → fresh branded PDF (download URL)
```
- **No signed re-upload** (unlike JMC). Download gating handled on FE (backend exposes `approvalStatus`).
- PDF: header (Eureka + GSTIN) · Vendor + Project · Items (#, Item/Make, HSN, Qty, Rate, Amount) ·
  Totals (Taxable, CGST+SGST **or** IGST, Total).

### 3.2 Site-scoped create authorization (shared helper `checkSiteCreateAccess`)
```
user must have a CURRENT allocation to the site (site_allocations.isCurrentlyAllocated = true)
  PO       → if site.siteTypes includes 'Civil'  → allocation.role must be 'Project Manager'
             else (Electrical-only)              → any current allocation
  JMC      → any current allocation (team or PM)
  Invoice  → any current allocation (team or PM)
```
- FE button gating: `GET /purchase-orders/can-create?siteId=` → `{ allowed, reason }` (no throw).
- Applied at create-time in PO / JMC / Invoice services (in addition to the base `*.create` permission).

### 3.3 Payment Request (→ book payment)
```
POST /payment-requests { invoiceId, requestedAmount, reason }   → status PENDING (site/PO derived from invoice)
POST /payment-requests/:id/approve { approvedAmount?, remarks? }
      • approvedAmount defaults to requestedAmount (adjustable)
      • creates a book_payment for the approved amount against the invoice  (→ flows to payment sheet)
      • request → APPROVED, bookPaymentId linked
POST /payment-requests/:id/reject { reason }                    → status REJECTED
```
- Approver is **permission-based** (`financials.payment-requests.approve`), not a fixed role.
- Only a **PENDING** request can be approved/rejected (terminal after).

---

## 4. Endpoints

### Purchase Orders (`/purchase-orders`)
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/` | Create (system-generated if `items[]`, else legacy upload) | `financials.purchase-orders.create` **+ site check** (system-gen) |
| PATCH | `/:id` | Update (items replace + recompute; PENDING+unlocked only) | `...update` |
| GET | `/` | List | `...view-list` |
| GET | `/:id` | Detail (+ `items[]`, `isSystemGenerated`) | `...view-list` |
| GET | `/:id/pdf` | System-generated PO PDF download URL | `...view-list` |
| GET | `/items/suggestions?search=&limit=` | Item typeahead | `...view-list` |
| GET | `/default-items` | Default line items (FE pre-fill) | `...view-list` |
| GET | `/can-create?siteId=` | Can current user create a PO here (FE gating) | `...view-list` |
| GET | `/dropdown` | (existing) PO dropdown for JMC | `...view-list` |
| DELETE | `/:id` | Delete (PENDING+unlocked, no children) | `...delete` |
| POST | `/:id/approve` · `/:id/reject` | Approve / reject | `...approve` |
| POST | `/:id/unlock-request` · `/unlock-grant` · `/unlock-reject` | Unlock flow | `...update` / `...unlock` |

### Payment Requests (`/payment-requests`)
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/` | Raise a request against an invoice | `financials.payment-requests.create` |
| GET | `/?siteId=&invoiceId=&status=&page=&pageSize=` | List | `financials.payment-requests.view-list` |
| GET | `/:id` | Detail | `financials.payment-requests.view-list` |
| POST | `/:id/approve` | Approve (adjust amount) → creates book payment | `financials.payment-requests.approve` |
| POST | `/:id/reject` | Reject | `financials.payment-requests.approve` |

> JMC / Invoice / Book-Payment endpoints are unchanged except the **site-scoped create check**
> (JMC & Invoice) and the **reject-terminal** lock (all financial docs, done earlier).

---

## 5. Validations

### 5.1 Create PO (`CreatePurchaseOrderDto`)
| Field | Rule |
|---|---|
| `siteId` | required, UUID v4 |
| `partyType` | required, `SALE` \| `PURCHASE` |
| `contractorId` / `vendorId` | optional UUID; **party-shape**: SALE⇒contractor, PURCHASE⇒vendor (validated) |
| `poNumber` | optional (auto when omitted), non-empty, ≤100 |
| `poDate` | required, ISO date |
| `items[]` | optional, ≤500; each item validated (below). **Presence ⇒ system-generated ⇒ PURCHASE only** |
| `items[].itemName` | required, ≤255 |
| `items[].hsnCode` | optional, ≤20 |
| `items[].make` | optional, ≤255 |
| `items[].quantity` | required, number ≥0, ≤3 dp |
| `items[].rate` | required, number ≥0, ≤2 dp |
| `items[].amount` | required, number ≥0, ≤2 dp |
| `gstPercentage` | optional, number ≥0 |
| `gstType` | optional, `CGST_SGST` \| `IGST` |
| `taxableAmount` / `gstAmount` / `totalAmount` | optional (computed from items for system-gen); required for legacy upload |
| `fileKey` / `fileName` | optional (≤500 / ≤255); required for legacy upload |
| `remarks` | optional |

### 5.2 Business rules (PO)
- **Items present** → PURCHASE only (else `400 ITEMS_ONLY_FOR_PURCHASE`); site-scoped auth (`403` if not allowed); amounts computed server-side (client amounts ignored for system-gen).
- **No items (legacy upload)** → `poNumber`, `taxableAmount`, `totalAmount`, `fileKey`, `fileName` all required (else `400 UPLOAD_FLOW_FIELDS_REQUIRED`); `total = taxable + gst` enforced.
- **PO number uniqueness** within (`siteId`, `partyType`, `poNumber`).
- **Edit / delete** only while `PENDING` and not locked.
- **Reject is terminal** — rejected PO is locked; cannot be approved/edited/deleted (create a new one).
- **PDF** only for system-generated PO (else `400`).

### 5.3 Site-scoped auth reasons (`403`)
- `You are not allocated to this site.`
- `Civil site: only the site Project Manager can create this document.` (PO on a Civil site)

### 5.4 Payment Request
| DTO | Field | Rule |
|---|---|---|
| Create | `invoiceId` | required UUID; invoice must exist |
| | `requestedAmount` | required, number ≥0.01, ≤2 dp |
| | `reason` | optional |
| Approve | `approvedAmount` | optional, number ≥0.01 (defaults to requested) |
| | `remarks` | optional (carried to the book payment) |
| Reject | `reason` | required |

- Approve/reject only when status = **PENDING** (else `400` "Only a PENDING payment request can be actioned.").
- Approval creates the book payment via the existing book-payment flow (invoice must be approved, PO ceiling, etc. — enforced there).

---

## 6. Permissions
New (`isEditable=true, isDeletable=true`, module `financials`, platform `web`):
- `financials.payment-requests.view-list`
- `financials.payment-requests.create`
- `financials.payment-requests.approve`

Reused (existing): `financials.purchase-orders.{create,view-list,update,delete,approve,unlock}`,
`financials.vendors.create`.

> Convention: permissions are **per-action-type** (view-list / create / update / approve / delete /
> unlock), not per-endpoint — so all reads share `view-list`, approve+reject share `approve`, etc.
> This matches the existing PO / JMC / document-status modules.

**Role → permission assignment is a separate admin task** (role-permissions UI). Until granted, the
guard fails closed (403). Grant to the relevant roles:
- `financials.purchase-orders.create` → PM / site-team roles
- `financials.payment-requests.*` → relevant roles
- `financials.vendors.create` → PM role (this is how "PM can add vendor" is enabled — no code)

---

## 7. Testing (dev DB, real data, reversible)
- **PO**: auto number `PO/2627/0001`, amounts computed (145000 + 18% = 171100), items (HSN/Make), PDF ✅
- **Site-scoped**: Electrical+Engineer → allowed; Civil+Engineer → denied (PM only); not-allocated → denied ✅
- **JMC/Invoice**: outsider blocked; allocated user passes ✅
- **Payment Request**: create → approve (1000→800) → book payment auto-created & linked → reject blocked on non-PENDING; invoice/PO rollups restored after test ✅
- `tsc` exit 0 on every change; migrations 32-37 applied on dev.

---

## 8. Not in scope / follow-ups
- **Deploy** + run migrations 32-37 on UAT/prod.
- **Permission grants** (admin UI) — see §6.
- **JMC/Invoice now require site allocation** — users (incl. admins) not allocated to a site can no
  longer create JMC/Invoice there. Add a SUPER_ADMIN bypass if the team wants one.
- **Default PO items** — replace the seeded placeholder with the real defaults.
- **Material consumption** (future) — model is forward-compatible (numeric qty, stable item ids
  post-approval, room for a `po_item_consumption` table).
