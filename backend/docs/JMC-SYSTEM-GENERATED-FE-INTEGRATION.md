# JMC System-Generated Enhancement — Frontend Integration Guide

Everything the FE needs for the new **system-generated JMC** flow: endpoints, request/response
shapes, validations, business rules, and the recommended UI flow.

- Base path: `/api/v1/jmcs`
- Auth: JWT + standard headers (`X-Active-Role`, `X-Correlation-Id`, `X-Client-Type`,
  `X-Source-Type`) — same as all other endpoints.
- Scope: the generate/PDF/items features apply to **SALE** (contractor) JMCs only. PURCHASE is
  unchanged.

---

## 1. What changed at a glance

- A JMC can now be **system-generated** (created in-app with line items) **and/or** have an
  **uploaded signed copy**. Both live on the **same** JMC record.
- **JMC number is auto-generated** (`JMC/{FY}/{seq}`, e.g. `JMC/2627/0001`) — FE should **not**
  ask the user for it (still accepted if sent, for manual/PURCHASE cases).
- **File upload is optional at create**, but **mandatory before approval**.
- New line items (Item / Unit / Quantity), a **global item-name typeahead**, and a **branded PDF**.

---

## 2. Endpoints

### 2.1 Create JMC — `POST /jmcs`
Permission: `financials.jmcs.create`

Request body:
```jsonc
{
  "poId": "uuid",              // REQUIRED
  "jmcDate": "2026-07-20",     // REQUIRED (ISO date)
  "items": [                    // OPTIONAL (SALE only). Presence => system-generated JMC
    { "itemName": "Cement Bag", "unit": "Nos", "quantity": "120" },
    { "itemName": "Steel Rod",  "unit": "Kg",  "quantity": "540" }
  ],
  "remarks": "optional",
  // Usually OMIT the two below for the SALE generate flow:
  "jmcNumber": "optional — auto-generated if omitted",
  "fileKey": "optional — signed file can be uploaded later",
  "fileName": "optional"
}
```
Response:
```json
{ "message": "JMC created successfully", "id": "uuid", "jmcNumber": "JMC/2627/0001" }
```
Notes:
- Site / party type / contractor / vendor are derived from the PO — FE only sends `poId`.
- Sending `items` for a **PURCHASE** PO → `400 ITEMS_ONLY_FOR_SALE`.

### 2.2 Update JMC (incl. edit line items) — `PATCH /jmcs/:id`
Permission: `financials.jmcs.update`. Allowed only while **PENDING & not locked**.

Body (all optional):
```jsonc
{
  "jmcDate": "2026-07-21",
  "remarks": "…",
  "items": [ { "itemName": "Sand", "unit": "Cum", "quantity": "10" } ] // REPLACES all items
}
```
- `items` uses a **replace strategy**: whatever array you send becomes the full item list
  (send the complete list, not a diff). Omit `items` to leave them unchanged.

### 2.3 Upload signed copy — `PATCH /jmcs/:id/upload`
Permission: `financials.jmcs.update`. Allowed only while **PENDING & not locked**.
Attaches the signed file to the **existing** record — **no** PO/date/number re-entry.
```json
{ "fileKey": "s3-key-of-signed-file", "fileName": "signed.pdf" }
```
Response: `{ "message": "JMC signed copy uploaded successfully" }`

### 2.4 Get system-generated PDF — `GET /jmcs/:id/pdf`
Permission: `financials.jmcs.view`. SALE + system-generated (has items) only.
Always regenerated fresh (reflects latest edits; nothing cached).
Response:
```json
{ "url": "https://…s3…/jmcs/JMC-2627-0001.pdf?X-Amz-…", "key": "jmcs/JMC-2627-0001.pdf" }
```
FE: open/download `url` (short-lived presigned URL). Non-system-generated → `400`.

### 2.5 Item-name suggestions (typeahead) — `GET /jmcs/items/suggestions`
Permission: `financials.jmcs.view`. Global, name-only, case-insensitive.
Query: `?search=cem&limit=20` (limit optional, default 20, max 50)
Response:
```json
{ "records": ["Cement", "Cement Bag"] }
```
Use this to power the item-name autocomplete in the add-item row.

### 2.6 List — `GET /jmcs` (unchanged + new flags)
Each record now also includes: `isSystemGenerated` (bool), `hasUpload` (bool).

### 2.7 Detail — `GET /jmcs/:id` (unchanged + items & flags)
Now also includes:
```jsonc
{
  "isSystemGenerated": true,
  "hasUpload": false,
  "items": [ { "id":"…", "itemName":"…", "unit":"…", "quantity":"…", "sortOrder":0 } ],
  // …existing fields (po, site, contractor, approvalStatus, isLocked, etc.)
}
```

### 2.8 Approve — `POST /jmcs/:id/approve` (rule tightened)
Now requires the **uploaded signed file present** (in addition to PO being approved).
Without it → `400 UPLOAD_REQUIRED_FOR_APPROVAL`. FE should keep Approve **disabled until
`hasUpload === true`**.

> Unchanged endpoints: `reject`, `unlock-request`, `unlock-grant`, `unlock-reject`, `DELETE /:id`,
> `GET /dropdown`.

---

## 3. Validations (per field)

| Field | Rule |
|---|---|
| `poId` | required, UUID v4 |
| `jmcDate` | required, ISO date string |
| `jmcNumber` | optional; if sent: non-empty, max 100. Auto-generated when omitted |
| `fileKey` | optional at create (max 500); **required** in the upload endpoint |
| `fileName` | optional at create (max 255); **required** in the upload endpoint |
| `items` | optional array, max 500 items; **SALE only** |
| `items[].itemName` | required, non-empty, max 255 (free text) |
| `items[].unit` | required, non-empty, max 100 (**free text**) |
| `items[].quantity` | required, non-empty, max 100 (**free text** — not validated as a number) |
| `remarks` | optional string |
| `:id` (path) | must be a valid UUID (else `400`) |
| suggestions `search` | optional string; `limit` optional int 1–50 (default 20) |

Bad input → `400` with class-validator messages.

---

## 4. Business rules & error codes FE should handle

| Situation | Status | Message |
|---|---|---|
| Items sent for a PURCHASE JMC | 400 | `Line items can only be added to SALE (contractor) JMCs.` |
| Approve without uploaded file | 400 | `Signed JMC upload is required before approval.` |
| Approve while PO not approved | 400 | `Cannot approve JMC — parent PO must be approved first.` |
| PDF for non system-generated JMC | 400 | `PDF is available only for system-generated (SALE) JMCs with items.` |
| Edit / upload after it left PENDING | 400 | `Document can only be deleted while in PENDING state.` |
| Edit / upload when locked | 400 | `This document is locked …` |
| Duplicate JMC number under a PO | 409 | `JMC number already exists under this PO` |
| JMC not found | 404 | `JMC not found` |

Editing (update / upload / delete) is allowed **only while `approvalStatus = PENDING` and
`isLocked = false`**. After approval the JMC is locked.

---

## 5. Recommended UI flow (SALE JMC)

1. **Create**: user selects PO + date, then adds item rows (Item name with typeahead from
   `GET /jmcs/items/suggestions`, Unit, Quantity). Submit `POST /jmcs` → get `id` + auto
   `jmcNumber`. (No JMC-number input field needed.)
2. **Preview / print**: `GET /jmcs/:id/pdf` → open the returned `url`. Regenerates on every call,
   so it always reflects the latest edits.
3. **Edit** (until approved): `PATCH /jmcs/:id` with the full `items` array (replace).
4. **Sign & upload**: after physical signatures, upload the signed file → `PATCH /jmcs/:id/upload`.
   `hasUpload` becomes `true`.
5. **Approve**: enable the Approve button **only when `hasUpload === true`** (and PO approved),
   then `POST /jmcs/:id/approve`.

### Flags cheat-sheet
- `isSystemGenerated` → show the "Generate PDF / Edit items" affordances.
- `hasUpload` → gates the Approve action; also show an "Upload signed copy" CTA when `false`.

---

## 6. Notes
- The generated PDF shows: **Nature/Name of Work** = project (site) name, **Client/Owner** =
  Eureka Enterprises, **Contractor** = contractor name, the items table, and a signature block
  with two columns: **Eureka Enterprises** and the **site name**.
- Upload uses the existing file-upload mechanism (obtain `fileKey`/`fileName` the same way as other
  upload flows in the app).
- Not yet deployed to UAT/prod at time of writing — coordinate on release + migration run.
