# JMC System-Generated Enhancement — Implementation Spec

> Status: **Spec for review.** Requirement doc approved by lead; clarifications incorporated.
> Code only after this spec is approved. No code written yet.

Related: `JMC-SYSTEM-GENERATED-ENHANCEMENT-REQUIREMENT.md` (approved).

## Confirmed clarifications
1. Scope: **SALE only**. PURCHASE JMCs untouched.
2. **PO is still selected** on create (`poId` required; site/party/contractor derive from PO).
3. **jmcNumber auto-generated** — meaningful format (see §3).
4. Item suggestions: **name only**.
5. Unit & Quantity: **free text**.
6. New `jmc_items` table: **OK**.
7. **Editable until approved**; locked after approval.

---

## 1. Data model changes

### 1a. `jmcs` table (migration — ALTER)
- `fileKey` → **nullable** (signed copy uploaded later, not at create).
- `fileName` → **nullable**.
- **New** `isSystemGenerated` `boolean` default `false` — `true` when the JMC was created through
  the new generate flow (i.e. has line items). Drives the `systemGeneratedAvailable` flag.

> No data backfill needed: existing rows have `fileKey` set and `isSystemGenerated=false`
> (they are upload-only), which is correct.

### 1b. `jmc_items` table (migration — CREATE) — line items
Columns (+ BaseEntity: id, createdBy/updatedBy/deletedBy, timestamps, deletedAt):
- `jmcId` uuid, FK → `jmcs(id)` ON DELETE CASCADE, indexed.
- `itemName` varchar(255), not null.
- `unit` varchar(100), not null (free text).
- `quantity` varchar(100), not null (free text, per clarification #5).
- `sortOrder` int default 0 — preserve row order in the PDF/table.

### 1c. `jmc_item_masters` table (migration — CREATE) — global suggestion master
- `name` varchar(255), not null, **unique (case-insensitive)** — enforced via a
  `LOWER(name)` unique index.
- Grows as items are saved anywhere (global, not scoped to JMC/project/client).
- Rationale for a dedicated table (vs `SELECT DISTINCT` from `jmc_items`): survives item edits/
  deletes, gives clean case-normalized dedupe, fast prefix search.

---

## 2. Scope enforcement (SALE only)
- Line items, PDF generation, and `isSystemGenerated` apply **only when `partyType = SALE`**.
- If items are sent for a PURCHASE PO → `400` (`ITEMS_ONLY_FOR_SALE`).
- PURCHASE create/flow stays exactly as today.

---

## 3. Auto JMC number
- Format: **`JMC/{FY}/{seq}`** — e.g. `JMC/2627/0001`. `{FY}` = financial year code (same helper
  as payment sheets / PO). `{seq}` = zero-padded running number.
- **Global monotonic** sequence: `MAX(seq) + 1` computed over ALL rows **including soft-deleted**
  (learned from the payment-sheet duplicate-key bug — soft-deleted rows share the number space).
- `jmcNumber` becomes **optional** in the create DTO:
  - Not provided → auto-generate (the new SALE flow).
  - Provided → use as-is (keeps PURCHASE / manual entry working, backward-compatible).
- Uniqueness check retained.

> Open confirm: FY-scoped sequence reset each financial year (`JMC/2627/0001` → `JMC/2728/0001`),
> matching payment sheets. Assumed yes.

---

## 4. Create flow (`POST /jmcs`)
DTO additions to `CreateJmcDto`:
- `jmcNumber?` → now **optional** (auto if absent).
- `fileKey?`, `fileName?` → now **optional** (upload can come later).
- `items?: JmcItemDto[]` → `{ itemName, unit, quantity }[]` (SALE only).

Service `create()`:
1. Load & validate PO (existing checks).
2. Resolve `jmcNumber` (auto or provided).
3. If `partyType = SALE` and `items` present → `isSystemGenerated = true`.
4. Insert JMC + `jmc_items` in **one transaction**.
5. Upsert each `itemName` into `jmc_item_masters` (case-insensitive, dedupe).
6. Return `{ id, jmcNumber, message }`.

A JMC created this way sits in **PENDING with no upload** → shows in Pending until signed copy is
uploaded and it is approved (requirement #11).

---

## 5. Line-item editing (until approved)
- `PATCH /jmcs/:id` extended to accept `items?` — **replace strategy** in a transaction (delete
  existing `jmc_items`, insert the new set), plus master upsert. Allowed only while
  **PENDING & not locked** (existing `assertEditable`).
- After approval → locked (existing behavior); item edits blocked.

---

## 6. Upload signed copy against existing record (requirement #6)
- **New** `PATCH /jmcs/:id/upload` — body `{ fileKey, fileName }` only.
- Attaches the signed file to the **existing** JMC record; **no** PO/contractor/date/number re-entry.
- Allowed only while PENDING & not locked.
- Permission: `financials.jmcs.update`.

---

## 7. Approval gating (requirement #7)
- In `approve()` add a guard: if `!jmc.fileKey` → `400` (`UPLOAD_REQUIRED_FOR_APPROVAL`,
  "Signed JMC upload required before approval").
- Existing PO-approved guard stays. So: **PENDING → APPROVED requires the uploaded signed file**.

---

## 8. PDF generation (system-generated, on-demand, no cache)
- **New** `jmc-pdf.service.ts` (puppeteer HTML→PDF), modeled on `payment-sheet-pdf.service.ts`.
- **New** endpoint `GET /jmcs/:id/pdf` → generates fresh, uploads to S3, returns a download URL
  via `filesService.getDownloadFileUrl(key)`. **Always regenerate — never cache** (requirement #8;
  same as payment-sheet PDF).
- Only valid for SALE + `isSystemGenerated` (has items); else `400`/`404`.
- PDF content (from format + fields, requirement #2):
  - **Nature / Name of Work** = project/site name (`site.name`).
  - **Client / Owner** = own company name (`site.company.name`).
  - **Contractor** = `contractor.name`.
  - JMC number, JMC date, PO number, dates arranged cleanly.
  - **Items table**: Item | Unit | Quantity (ordered by `sortOrder`).
  - **Signature block — two columns** (blank signature space under each):
    - Column 1 label: **"Eureka Enterprises"**
    - Column 2 label: **the site name** (`site.name`)
- Permission: `financials.jmcs.view`.

---

## 9. Item suggestions endpoint (global autocomplete)
- **New** `GET /jmcs/items/suggestions?search=<text>&limit=<n>` → distinct item names from
  `jmc_item_masters`, prefix/ILIKE match, capped (e.g. 20). Name-only (clarification #4).
- Permission: `financials.jmcs.view`.

---

## 10. Response / list flags (requirement #9)
`findAll` + `findById` add:
- `isSystemGenerated` (boolean).
- `hasUpload` = `fileKey != null`.
- `items` (in `findById`; array of {itemName, unit, quantity, sortOrder}).
- `canApprove` hint (optional) = PO approved && hasUpload && not already approved.
- Existing eligibility/dropdown logic unchanged.

---

## 11. Permissions
Reuse existing `financials.jmcs.*` — no new permission rows:
- create → `financials.jmcs.create`
- upload / edit items → `financials.jmcs.update`
- pdf / suggestions / view → `financials.jmcs.view`
- approve (with new upload gate) → `financials.jmcs.approve`

> "Anyone can create" (requirement #10) is a **role-mapping** decision (grant `financials.jmcs.create`
> to the required roles) — handled via the roles admin UI, not code.

---

## 12. Migrations (new)
1. `alter-jmcs-nullable-file-add-system-generated` — fileKey/fileName nullable + `isSystemGenerated`.
2. `create-jmc-items-table`.
3. `create-jmc-item-masters-table`.

(All additive/backward-compatible; existing upload-only JMCs keep working.)

---

## 13. Files touched
- `entities/jmc.entity.ts` (nullable file, isSystemGenerated) + new `entities/jmc-item.entity.ts`,
  `entities/jmc-item-master.entity.ts`.
- `dto/create-jmc.dto.ts`, `dto/update-jmc.dto.ts`, new `dto/jmc-item.dto.ts`,
  new `dto/upload-jmc.dto.ts`, `dto/get-jmc.dto.ts` (suggestion query).
- `jmc.service.ts` (create/update transactions, upload, approve gate, suggestions, flags),
  new `jmc-pdf.service.ts`.
- `jmc.controller.ts` (upload, pdf, suggestions routes).
- `jmc.module.ts` (register pdf service, new entities/repos, filesService).
- `constants/jmc.constants.ts` (new errors/messages).
- 3 migrations.

---

## 14. Testing plan (dev DB, reversible)
- Create SALE JMC with items → verify auto number, items rows, master upsert, `isSystemGenerated`.
- Generate PDF → fields correct (project/company/contractor/items), regenerates each call.
- Edit items while PENDING → replace works; after approve → blocked.
- Upload signed file via `/upload` → attaches without re-entering data.
- Approve without upload → blocked; with upload → approves.
- Suggestions endpoint → prefix match, global, deduped.
- PURCHASE JMC → unchanged; items rejected.

---

## Open items — CONFIRMED
- A) FY-scoped sequence reset (§3) — **yes**, resets each FY.
- B) Auto-number applies to **SALE only**; PURCHASE keeps manual entry.
- C) PDF signature block — **two columns**: "Eureka Enterprises" + the site name (§8).

Spec fully confirmed. Ready to implement on approval.
