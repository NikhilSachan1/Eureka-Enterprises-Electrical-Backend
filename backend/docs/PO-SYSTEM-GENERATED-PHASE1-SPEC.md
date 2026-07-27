# PO System-Generated — Phase 1 Implementation Spec

> Status: **Spec for review.** Requirement doc approved (`PO-SYSTEM-GENERATED-SITE-SCOPED-REQUIREMENT.md`).
> Phase 1 = **System-generated PO + line items + auto-number + PDF + item master + default items +
> site-scoped create auth (PO)**. Code only after this spec is approved.

Later phases (out of scope here): Payment Request module, Vendor permission, JMC/Invoice site-scoping
(reuses the same auth helper), material-consumption.

---

## 1. Current state (PO today)
- Upload-based: `poNumber` (manual), `poDate`, `taxableAmount`, `gstAmount`, `gstPercentage`,
  `totalAmount`, `fileKey`/`fileName` (mandatory scan), party (SALE=contractor / PURCHASE=vendor),
  `approvalStatus`, `isLocked` + approval/lock/unlock (+ reject-terminal already added).
- No line items, no system-generated PDF, number manual.

---

## 2. Data model

### 2a. `purchase_orders` (ALTER)
- `fileKey`, `fileName` → **nullable** (system-generated PO me upload nahi).
- **New** `isSystemGenerated` boolean default `false` (true when created with line items).
- **New** `gstType` varchar(10) default `'CGST_SGST'` (`'CGST_SGST'` | `'IGST'`) — PDF tax split.
- (taxable/gst/total amount columns already exist — reuse.)

### 2b. `po_items` (CREATE) — line items
BaseEntity + :
- `poId` uuid FK → `purchase_orders(id)` ON DELETE CASCADE, indexed
- `itemName` varchar(255)
- `hsnCode` varchar(20), nullable
- `make` varchar(255), nullable  *(brand/manufacturer)*
- `quantity` numeric(15,3)  *(qty — numeric, unlike JMC free-text)*
- `rate` numeric(15,2)
- `amount` numeric(15,2)  *(= quantity × rate; sent by FE, re-validated server-side)*
- `sortOrder` int default 0

### 2c. `po_item_masters` (CREATE) — global suggestions (PO-specific, separate from JMC)
- `name` varchar(255), **case-insensitive unique** (`LOWER(name)` unique index)
- Grows as PO items saved; feeds PO typeahead.

### 2d. `po_default_items` (CREATE + seed) — default line items
- `itemName` varchar(255), `hsnCode` varchar(20) nullable, `make` varchar(255) nullable,
  `sortOrder` int default 0, `isActive` boolean default true
- **Seed via migration: 1 placeholder row** (lead correct items baad me daalega). Not editable (no
  CRUD endpoint for now).

---

## 3. Auto PO number
- Format **`PO/{FY}/{seq}`** (e.g. `PO/2627/0001`), FY-scoped, `MAX(seq)+1` over ALL rows incl.
  soft-deleted (matched by `PO/{FY}/` prefix) — payment-sheet/JMC wala collision-safe pattern.
- `poNumber` becomes **optional** in create DTO → auto when omitted; provided value respected
  (backward-compat for the old manual/upload flow).

---

## 4. Scope: PURCHASE only
- System-generated PO (with items) is **PURCHASE only** (vendor). `partyType=PURCHASE`, `vendorId`
  required. SALE + items → `400 (ITEMS/SYSTEM-GEN only for PURCHASE)`.
- Old upload-based create (SALE or PURCHASE, manual number, fileKey) stays working.

---

## 5. Create flow (`POST /purchase-orders`)
DTO additions to `CreatePurchaseOrderDto`:
- `poNumber?` → optional (auto if omitted)
- `fileKey?`, `fileName?` → optional
- `items?: PoItemDto[]` → `{ itemName, hsnCode?, make?, quantity, rate, amount }[]`
- `gstPercentage?` (already used) drives GST

Service `create()` (system-generated path when `items` present):
1. **Site-scoped auth** (see §6) — `assertCanCreatePo(userId, siteId)`.
2. `partyType` must be PURCHASE (else reject items).
3. Resolve `poNumber` (auto/provided).
4. **Compute amounts from items** (server-side, don't trust client blindly):
   - `taxableAmount = Σ item.amount`
   - `gstAmount = round(taxableAmount × gstPercentage/100)` (if gstPercentage given)
   - `totalAmount = taxableAmount + gstAmount`
5. Insert PO (`isSystemGenerated=true`, fileKey/fileName null) + `po_items` in **one transaction**.
6. Upsert item names into `po_item_masters`.
7. Return `{ id, poNumber, message }`.

Editing items (while PENDING & not locked) via `PATCH /purchase-orders/:id` — replace strategy
(same as JMC): delete existing `po_items`, insert new set, master upsert, recompute amounts.

---

## 6. Site-scoped create authorization (PO)
Reusable helper (new) — decides if a user may create a PO for a site, using `site_allocations`
(Option A) + `site.siteTypes`:

```
assertCanCreatePo(userId, siteId):
  site = load site (siteTypes[])
  alloc = current active site_allocation for (userId, siteId)   // isCurrentlyAllocated, not deleted
  if !alloc → 403 (not allocated to this site)
  isCivil = site.siteTypes includes 'Civil'   (case-insensitive)
  if isCivil AND alloc.role != 'Project Manager' → 403 (Civil PO: only site PM)
  // Electrical-only site → any allocation is fine
```

- **Mixed site (Civil + Electrical):** Civil present ⇒ PM-only (per approved decision).
- Base permission `financials.purchase-orders.create` still required (guard) — the site check is an
  **additional** gate in the service.
- **FE button gating** — `GET /purchase-orders/can-create?siteId=` → `{ allowed: boolean, reason }`
  (runs the same helper without throwing) so FE can show/hide the create button.

> Note: same helper will later gate JMC/Invoice (Phase 1b) with a "any allocation" rule (no Civil
> check). Built here, reused there.

---

## 7. PDF (`po-pdf.service.ts`, on-demand, no cache)
- New `po-pdf.service.ts` (puppeteer), branded like JMC/payment-sheet.
- `GET /purchase-orders/:id/pdf` → generate fresh → S3 → return download URL. SALE/upload-only or
  non-system-generated → `400`.
- Content:
  - Header: EUREKA branding + "PURCHASE ORDER" + poNumber + poDate.
  - Vendor block (bill-to/vendor name), site/project.
  - **Items table**: #, Item, HSN, Make, Qty, Rate, Amount.
  - **Totals**: Taxable | **CGST** (gstAmount/2) | **SGST** (gstAmount/2) | **Total**. *(CGST/SGST =
    half of gstAmount — intra-state assumption; confirm if IGST/inter-state ever needed.)*
- **Download gating** — handled by FE (lead); backend just returns URL / exposes `approvalStatus`.

---

## 8. Item suggestions
- `GET /purchase-orders/items/suggestions?search=&limit=` → distinct names from `po_item_masters`
  (ILIKE, capped). Permission `financials.purchase-orders.view`.

## 9. Default items
- `GET /purchase-orders/default-items` → active rows from `po_default_items` (for FE to pre-fill a
  new PO). Permission `financials.purchase-orders.view`.

---

## 10. List / detail
- `findAll` + `findById` → add `isSystemGenerated`, and `items[]` (findById; findAll optional).

---

## 11. Endpoints summary
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/purchase-orders` | Create (items, auto-number, site-scoped) | `...create` + site check |
| PATCH | `/purchase-orders/:id` | Edit (items replace, PENDING only) | `...update` + site check |
| GET | `/purchase-orders/:id/pdf` | System-gen PO PDF URL | `...view` |
| GET | `/purchase-orders/items/suggestions` | Item typeahead | `...view` |
| GET | `/purchase-orders/default-items` | Default line items | `...view` |
| GET | `/purchase-orders/can-create?siteId=` | FE button gating | `...view` |

(Existing PO routes — list/detail/approve/reject/unlock — unchanged except reject-terminal already done.)

---

## 12. Migrations (new)
1. `alter-purchase-orders-nullable-file-add-system-generated`
2. `create-po-items-table`
3. `create-po-item-masters-table`
4. `create-po-default-items-table` (+ seed 1 placeholder)

All additive/backward-compatible; existing upload-based POs keep working.

---

## 13. Files touched
- Entities: `purchase-order.entity.ts` (nullable file + isSystemGenerated) + new `po-item.entity.ts`,
  `po-item-master.entity.ts`, `po-default-item.entity.ts` (+ register in `config.service.ts` datasource).
- DTOs: `create-purchase-order.dto.ts` (items, optional number/file), `po-item.dto.ts`,
  suggestion query DTO.
- Service: `purchase-order.service.ts` (create/update transactions, auto-number, amounts-from-items,
  site-scoped helper, suggestions, default-items, canCreate) + new `po-pdf.service.ts`.
- Controller: pdf / suggestions / default-items / can-create routes.
- Module: register pdf service, new entities/repos, FilesModule.
- New site-scoped auth helper (in PO service or a shared financials helper for later reuse).
- 4 migrations.

---

## 14. Testing plan (dev DB, reversible)
- Create PURCHASE PO with items → auto number, items rows, amounts computed (taxable/GST/total),
  master upsert, `isSystemGenerated`.
- Site-scoped: Civil site + non-PM allocation → 403; Civil + PM → ok; Electrical + any allocation →
  ok; not allocated → 403. `can-create` returns matching `{allowed}`.
- PDF → items + HSN/Make + CGST/SGST/Total correct; regenerates each call.
- Suggestions + default-items endpoints.
- Edit items while PENDING → replace + amounts recompute; after approve → blocked (existing lock).
- Old upload-based create (manual number + fileKey) still works.

---

## 15. Resolved decisions
- **GST — scalable** ✅ Add `gstType` varchar on `purchase_orders`: **`'CGST_SGST'` (default) | `'IGST'`**.
  PDF: `CGST_SGST` → CGST=SGST=gstAmount/2; `IGST` → single IGST line = gstAmount. Dono support.
- **quantity numeric** ✅ `numeric(15,3)`; amount = qty × rate.
- **default-items fields** ✅ `itemName`, `hsnCode`, `make` (qty/rate blank — user bhare). Best UX.
- **Default PO items — IN SCOPE** ✅ (not editable, migration se 1 placeholder, `GET /default-items`).

## 16. Forward-compat: Material consumption (future, abhi nahi banayenge)
Data model aise rakha ki baad me consumption/remaining-stock add karne pe issue na ho:
- `po_items` **BaseEntity** (stable `id`, soft-delete) → future `po_item_consumption` table iski
  `id` ko FK kar sakega.
- `quantity` **numeric** → `remaining = quantity − Σ consumed` computable.
- Items **approve ke baad locked** (edit/replace nahi) → jab consumption aayega tab item ids stable
  honge (approved PO pe hi consumption chalega). Replace-on-edit sirf PENDING pe, jahan consumption
  hoti hi nahi. **Koi future clash nahi.**
