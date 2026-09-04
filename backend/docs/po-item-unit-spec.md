# Spec — Unit on PO Line Items

**Status:** implemented 2026-09-04 — all 4 decisions confirmed by the user, 16/16 API tests pass on dev
**Date:** 2026-09-04
**Requested by:** user — "when we generate the PO or add edit, we also need Unit as well. i mean we
have quantity, but we need unit as well, return it in response, get apis, po pdf, items an all
wherever needed. also above units can be put in config settings."

## 1. Goal

A PO line item currently has `quantity` but no **unit**, so "10" carries no meaning — 10 Nos, 10 Kg
and 10 Sqm are indistinguishable. Add `unit` alongside `quantity` everywhere a line item is
written, read, or printed, and drive the allowed values from **config settings** rather than
hardcoding them.

## 2. Current state (verified)

| Layer | State |
|---|---|
| `po_items` table / `PoItemEntity` | **No `unit` column.** Has `itemName, description, hsnCode, make, quantity, rate, amount, sortOrder` |
| `PoItemDto` | No `unit` — [`po-item.dto.ts`](../src/modules/purchase-orders/dto/po-item.dto.ts) |
| `saveItems` | Persists 8 fields, no unit — [`purchase-order.service.ts:405`](../src/modules/purchase-orders/purchase-order.service.ts#L405) |
| PO PDF | Single `Qty` column — [`po-pdf.service.ts:295`](../src/modules/purchase-orders/po-pdf.service.ts#L295) header, [`:163`](../src/modules/purchase-orders/po-pdf.service.ts#L163) cell |
| `po_default_items` (pre-fill) | No unit; `getDefaultItems` returns only `itemName, hsnCode, make` |
| `po_item_masters` (suggestions) | No unit |
| Unit config | **Does not exist.** `purchase_order` module currently has only `po_default_terms` |
| List / detail responses | Items come off the **entity relation** (`po.items`), so a new column appears automatically — no query changes needed |

## 3. Config-driven unit list

Follows the established dropdown pattern exactly — `configurations` row + `config_settings.value`
as a jsonb array of `{label, value}`, same as `bank_names_dropdown` and `asset_categories`:

```
configurations:  module = 'purchase_order'
                 key    = 'po_units'
                 label  = 'PO Units'
                 valueType = 'array'
                 isEditable = true

config_settings.value = [ {"label":"Nos","value":"Nos"}, {"label":"Each","value":"Each"}, … ]
```

The 39 units supplied by the user are seeded verbatim. Because `isEditable` is true, units can be
added or removed from the config-settings admin UI without a deploy.

**No new endpoint needed.** FE reads it via the existing generic config API, the same way it already
reads every other dropdown:

```
GET /configurations/details?key=po_units
```

A GST-type list (`CGST_SGST` / `IGST`) was also supplied, but PO already handles GST type, so it is
**out of scope** here — flagged in §7.

## 4. Data model — migrations

Per the project rule, all schema changes via TypeORM migration.

| Migration | Change |
|---|---|
| `…051-add-unit-to-po-items` | `ALTER TABLE po_items ADD COLUMN "unit" varchar(20) NULL` |
| `…052-seed-po-units-config` | Seed the `po_units` configuration + config_settings row (idempotent, `NOT EXISTS` guard, mirroring `…045-seed-vendor-code-config`) |

`varchar(20)` is sized for the longest supplied value ("Bundle" = 6) with headroom.

**Nullable, not `NOT NULL`:** existing `po_items` rows have no unit and there is no correct value to
backfill them with — guessing "Nos" would silently invent data on historical POs. Nullable keeps
old rows honest and lets FE adopt the field without a coordinated deploy. See decision 1.

## 5. Code changes

| File | Change |
|---|---|
| `entities/po-item.entity.ts` | + `unit: string \| null` |
| `dto/po-item.dto.ts` | + `unit` (optional, `@MaxLength(20)`) |
| `purchase-order.service.ts` → `saveItems` | Persist `unit` (trimmed, `\|\| null`) |
| `po-pdf.service.ts` | New `Unit` column in the items table |
| `purchase-order.service.ts` → `getDefaultItems` | Return `unit` (only if decision 3 = yes) |
| item-suggestion mapping | Return `unit` (only if decision 3 = yes) |
| `migration/…051`, `…052` | As above |

Create, update and read all flow through `PoItemDto` → `saveItems` → entity relation, so a single
field addition covers add, edit, list and detail. Update already deletes and re-inserts items
([`:468`](../src/modules/purchase-orders/purchase-order.service.ts#L468)), so no separate edit path.

## 6. PDF layout

The items table gains a `Unit` column between `Qty` and `Rate`. Qty is currently 70px; the new
column takes ~55px, absorbed from the description column, which is the widest and most flexible.
When `unit` is null the cell renders empty rather than a placeholder, so historical POs reprint
unchanged in meaning.

## 7. Out of scope

1. **GST type dropdown** (`PO_GST_TYPE_DATA`) — PO already handles GST type; moving that list into
   config is a separate change.
2. **Backfilling `unit` on existing `po_items`** — no correct value exists to infer. Left null.
3. **Unit conversion / normalisation** (e.g. Kg ↔ MT) — the field is a label, not a measurement
   system. A future material-consumption feature would need this; noted, not built.

## 8. Test plan (dev DB, real API)

1. Create a PO with items carrying units → `unit` persisted per item, correct per row.
2. Create a PO with **no** unit on items → succeeds, `unit` null (backward compatibility).
3. Edit a PO changing only units → new values persisted, others untouched.
4. `GET /purchase-orders` and `GET /purchase-orders/:id` → `unit` present on every item.
5. PO PDF → Unit column renders; a null unit leaves the cell blank without breaking layout.
6. `GET /configurations/details?key=po_units` → all 39 units returned in `{label, value}` shape.
7. Unit longer than 20 chars → 400.
8. If decision 2 = validate: a unit outside the config list → 400; a valid one → 201.
9. Existing POs created before the change → still readable, `unit` null, PDF still renders.

## 9. Decisions needed

1. **Is `unit` required or optional on new POs?**
   *Recommend optional now* (nullable column, no `@IsNotEmpty`) so BE can ship before FE. Once FE
   always sends it, a follow-up can make it required. Making it required today breaks PO creation
   from the current app build.
2. **Validate `unit` against the `po_units` config, or accept free text?**
   *Recommend validate* — asset already rejects an off-config `category` ("Invalid category"), so
   this matches house behaviour and stops "nos"/"NOS"/"Nos." drift. Cost: adding a unit to the
   config becomes mandatory before it can be used.
3. **Add `unit` to `po_default_items` and `po_item_masters` too?**
   *Recommend yes* — otherwise default items pre-fill without a unit and suggestions forget the
   unit last used for that item, so the user retypes it every time. Adds 2 columns and 2 mappings.
4. **PDF: separate `Unit` column, or append to Qty ("10 Nos")?**
   *Recommend separate column* — cleaner and standard on a PO. Appending avoids touching table
   widths but makes the quantity non-numeric in the printed output.

---

## 10. Decisions taken (confirmed by user)

| # | Decision | Chosen |
|---|---|---|
| 1 | `unit` required or optional | **Optional** — nullable column, no `@IsNotEmpty`, so BE ships before FE |
| 2 | Validate against config, or free text | **Validate** against `po_units` |
| 3 | Add `unit` to `po_default_items` + `po_item_masters` | **Yes** |
| 4 | PDF: separate column or appended to Qty | **Separate `Unit` column** |

## 11. Implementation notes

### Validation fails open by design

`assertValidUnits` skips validation (with a logged warning) when the `po_units` config row is
missing or not an array. A deleted config would otherwise block **every** PO creation that sends a
unit — far worse than accepting one unvalidated value. The warning makes the misconfiguration
visible instead of silent.

### `po_item_masters` remembers the last unit

`upsertItemMasters` changed from `ON CONFLICT DO NOTHING` to
`DO UPDATE SET unit = COALESCE(EXCLUDED.unit, po_item_masters.unit)`. Two consequences:

- Re-saving a PO **refreshes** the remembered unit for that item name.
- A line saved *without* a unit does **not** wipe the remembered one — hence the `COALESCE`.

Where one PO has the same item name twice with different units, the last non-empty one wins.

### ⚠ Breaking response change — `items/suggestions`

`GET /purchase-orders/items/suggestions` previously returned `records` as a **plain string array**:

```json
{ "records": ["Cement", "Steel Rod"] }
```

It now returns objects, so the typeahead can pre-fill the remembered unit:

```json
{ "records": [ { "name": "Cement", "unit": "Bag" } ] }
```

**FE must be updated for this endpoint** — it is the only breaking change in this spec. Everything
else is additive.

### PDF

Items table went from 6 to 7 columns; the `colspan` on the "No items" row was updated to match. A
null unit renders an empty cell, so historical POs reprint unchanged.

## 12. Test results — real API against dev DB

Migrations `…051` and `…052` applied to `eureka_enterprises_dev`. **16/16 passed.**

| Case | Result |
|---|---|
| `po_units` config returns all 39 units in `{label, value}` shape | ✅ |
| Create PO with units → 201, persisted per item | ✅ |
| Create PO with **no** unit → 201, `unit` null (backward compatible) | ✅ |
| Unit outside the config (`Furlong`) → 400 naming the allowed list | ✅ |
| Unit longer than 20 chars → 400 | ✅ |
| `GET /purchase-orders/:id` → `unit` on every item | ✅ |
| Edit changing only units → persisted; **quantity untouched** | ✅ |
| `po_item_masters` remembered the edited units (`MT`, `Qtl`) | ✅ |
| `items/suggestions` → `{name, unit}` objects | ✅ |
| `default-items` exposes `unit` | ✅ |
| PDF renders with the new column | ✅ |

All test POs, items and item-master rows removed afterwards; dev left clean.
