# Spec — Vendor Code Sequence Starts at 10001 (+ renumber existing)

**Status:** implemented 2026-09-04 — decisions confirmed by user
**Date:** 2026-09-04
**Requested by:** user — "vendor code will start from 10001 - and fix the exisitng ones"

## 1. Goal

New vendor codes should begin at **10001**, and existing vendors should be renumbered onto the same
sequence so there is one continuous run rather than two.

## 2. Current state (verified on both DBs)

| | |
|---|---|
| Config | `vendor_code_config` = `{"prefix": "VEN-", "padLength": 4}` (module `vendor`, editable) |
| Generator | `generateVendorCode()` — [`vendor.service.ts:84`](../src/modules/vendors/vendor.service.ts#L84). Reads the config, then `MAX(seq) + 1` over `vendorCode LIKE 'VEN-%'` **including soft-deleted rows**, so codes never collide |
| dev data | 3 vendors: `VEN-0001 … VEN-0003`, no nulls, no gaps |
| prod data | 19 vendors (18 live + 1 soft-deleted): `VEN-0001 … VEN-0019`, no nulls, no gaps |
| Where the code is used | **Display only.** Printed on the PO PDF ([`po-pdf.service.ts:267`](../src/modules/purchase-orders/po-pdf.service.ts#L267)) and returned in vendor responses. **No table stores or joins on it** — it is not a foreign key |

## 3. Target behaviour

| | Before | After |
|---|---|---|
| prod existing | `VEN-0001 … VEN-0019` | `VEN-10001 … VEN-10019` |
| next new vendor (prod) | `VEN-0020` | `VEN-10020` |
| dev existing | `VEN-0001 … VEN-0003` | `VEN-10001 … VEN-10003` |
| next new vendor (dev) | `VEN-0004` | `VEN-10004` |

Renumbering is **ordered by `createdAt ASC`**, the same ordering the original backfill used
([`…045`](../src/migration/1860000000045-seed-vendor-code-config-and-backfill.ts)), so relative
order is preserved: the oldest vendor stays first, `VEN-0001` → `VEN-10001`.

## 4. Config change

```
{"prefix": "VEN-", "padLength": 4}          →  {"prefix": "VEN-", "padLength": 5, "startFrom": 10001}
```

`padLength: 5` because 10001 is five digits. (Strictly, `padStart` never truncates, so 4 would still
render `10001` — but 5 is what the value actually is, and leaving 4 would be misleading to the next
reader.)

### Why a new `startFrom` key rather than relying on the data

The generator derives the next code from `MAX(seq) + 1`. Renumbering alone would *appear* to work,
because after the backfill `MAX` is 10019 → next is 10020. But it is only true while rows exist: if
the vendors table were ever emptied (a fresh environment, a wiped QA DB), `MAX` returns 0 and the
next code would fall back to `VEN-0001` — silently undoing the requirement.

`startFrom` makes the floor explicit and survives an empty table:

```
next = MAX( currentMaxSeq, startFrom - 1 ) + 1
```

It is also self-documenting in the admin UI, and a future "start from 20001" needs a config edit
rather than another migration.

## 5. Code change

`generateVendorCode()` gains the floor. One expression, no behaviour change when data exists:

```ts
const startFrom = Number(cfg.startFrom ?? 1);
const next = Math.max(Number(rows?.[0]?.maxseq ?? 0), startFrom - 1) + 1;
```

`previewNextVendorCode()` (the FE "next code" preview) calls the same method, so it stays correct
with no separate change.

## 6. Migration

One migration, `…054-vendor-code-start-10001`:

1. **Update the config** to `{prefix, padLength: 5, startFrom: 10001}` — guarded so it only rewrites
   the `vendor_code_config` row.
2. **Renumber every vendor** (including soft-deleted — see decision 2) by `createdAt ASC, id ASC`:

```sql
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
    FROM vendors
   WHERE "vendorCode" LIKE 'VEN-%'
)
UPDATE vendors v
   SET "vendorCode" = 'VEN-' || (10000 + o.rn)::text, "updatedAt" = NOW()
  FROM ordered o
 WHERE v.id = o.id;
```

`id ASC` is the tiebreaker so two vendors sharing a `createdAt` timestamp renumber deterministically
rather than arbitrarily.

**Not idempotent in the usual sense, and deliberately so:** re-running it would renumber from 10001
again. That is harmless (same input → same output, since the ordering is stable) but it means the
migration must not be edited-and-rerun after new vendors exist. Noted rather than engineered around,
because TypeORM runs each migration once.

`down()` restores the config to `{prefix: 'VEN-', padLength: 4}` and renumbers back to a 4-digit
sequence from 1, using the identical ordering — so the rollback is exact.

## 7. Consequences

1. **Every PO PDF reprints with the new vendor code.** PDFs are *always regenerated fresh, never
   cached* ([`po-pdf.service.ts:13`](../src/modules/purchase-orders/po-pdf.service.ts#L13)), so a PO
   issued to a vendor last month will show `VEN-10007` where the copy they hold says `VEN-0007`.
   This is the only material consequence. Accepted: the code is a display field, nothing references
   it, and one continuous sequence was the explicit request.
2. **No referential risk.** No table stores `vendorCode`; nothing joins on it.
3. **Anyone who has memorised or externally recorded a vendor code** (a spreadsheet, an email) sees
   a mismatch. Worth telling the finance/purchase team before the prod run.
4. **CORRECTION to an earlier draft of this spec:** `vendorCode` *does* have a unique index —
   `UQ_VENDORS_VENDOR_CODE_LOWER` on `lower("vendorCode")` WHERE `"vendorCode" IS NOT NULL`. It is a
   partial expression index, which is why it does not appear in `pg_constraint`. The renumber is
   safe because the old range (`VEN-0001…0019`) and the new range (`VEN-10001…`) are **disjoint**,
   so no row transiently collides during the UPDATE. A renumber whose ranges overlapped would fail,
   since a plain unique index is checked per row and not deferred.

## 8. Test plan (dev DB, real API)

1. Before: note the 3 existing codes and their `createdAt` order.
2. Run the migration → codes become `VEN-10001 … VEN-10003` in the same relative order.
3. `GET /vendors/next-code` → `VEN-10004`.
4. Create a vendor via API → gets `VEN-10004`; the one after → `VEN-10005`.
5. Soft-delete the newest vendor, create another → does **not** reuse the freed code (generator
   counts deleted rows).
6. PO PDF for an existing PO → renders the new code without error.
7. Revert the migration (`migration:revert`) → codes return to `VEN-0001 … VEN-0003` and config to
   `padLength: 4`; then re-run it.
8. Simulate an empty table (transaction, rolled back): with no vendors, the generator still returns
   `VEN-10001` rather than `VEN-0001` — proves `startFrom` works, which is the whole point of §4.

## 9. Decisions needed

1. **Keep the `VEN-` prefix?** This spec assumes **yes** → `VEN-10001`. Every existing code carries
   it and the config already holds `prefix: "VEN-"`. If you meant a bare `10001` with no prefix, say
   so — it is a one-character config change but affects every existing code and the PDF.
2. **Renumber soft-deleted vendors too?** Recommend **yes** (prod has 1). Including them keeps the
   sequence contiguous and avoids a collision if one is ever restored. Excluding them would leave a
   stray `VEN-00xx` behind.
3. **Run on prod, and when?** Dev first regardless. The prod run renumbers 19 live records and
   changes what every PO PDF prints, so it wants a deliberate window — not something to slip in with
   an unrelated deploy.

---

## 10. Decisions taken (confirmed by user)

| # | Decision | Chosen |
|---|---|---|
| 1 | Keep the `VEN-` prefix | **Yes** — only the sequence changes → `VEN-10001` |
| 2 | Renumber soft-deleted vendors | **No** — live rows only |
| 3 | Run on prod | **Approved**, dev first |

The user also confirmed **no PO PDF has been shared with any vendor yet**, which removes
consequence §7.1 entirely — there is no outstanding paper copy to contradict.

### Why excluding soft-deleted rows is safe

The generator's `MAX(seq)` counts **all** rows including soft-deleted ones, so the concern is
whether leaving a deleted row on the old sequence can collide. It cannot:

- live rows renumber to `VEN-10001 … VEN-10018` (prod)
- the soft-deleted row keeps its original `VEN-00xx`
- ranges are disjoint, and `MAX` becomes 10018 → next new vendor is `VEN-10019`

The unique index (§7.4) is therefore never violated, and the freed old code is never reissued.
