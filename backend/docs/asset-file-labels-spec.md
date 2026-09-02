# Spec — Per-File Labels for Asset Images (Add / Update Asset)

**Status:** implemented 2026-09-02
**Date:** 2026-09-02
**Requested by:** user ("in add asset, update asset, are we taking label in request and returning, as user wanna identify which image is what")

**Scope:** labels only. An earlier draft of this spec also made `fileType`
caller-settable; the user scoped that out ("revert changes related to file type
and all, just label changes I need and keep it minimal"). `fileType` stays
hardcoded to `ASSET_IMAGE` on add/update, exactly as before. See §9.

## 1. Goal

Let the user identify **which uploaded image is what** on an asset, by accepting
a **per-file label** on `POST /assets` (add) and `PATCH /assets/:id` (update),
and returning it on read.

## 2. Current behavior (before)

The `label` column already existed and reads already returned it — the write
path simply never populated it.

| Layer | State before |
|---|---|
| DB column `assets_files.label` | **Existed** — varchar(255) nullable, created in [`1766000000000-revamp-asset-tables.ts:250`](../src/migration/1766000000000-revamp-asset-tables.ts#L250) |
| `AssetFileEntity.label` | Existed — [`asset-file.entity.ts:24`](../src/modules/asset-files/entities/asset-file.entity.ts#L24) |
| `AssetFilesService.create` | Accepted a **scalar** `label` and stamped it on every file in the batch |
| `CreateAssetDto` / `UpdateAssetDto` | **No label field** — only `assetFiles?: any` binaries |
| `create()` / `update()` file attach | Omitted `label` entirely |
| Reads | **Already returned `label`** — [`get-asset.query.ts:297`](../src/modules/asset-masters/queries/get-asset.query.ts#L297), [`:347`](../src/modules/asset-masters/queries/get-asset.query.ts#L347), [`asset-events.queries.ts:145`](../src/modules/asset-events/queries/asset-events.queries.ts#L145), [`asset-masters.service.ts:461`](../src/modules/asset-masters/asset-masters.service.ts#L461) |
| Editing a label after upload | **Not possible** — `asset-files.controller.ts` exposes only `@Post()`, and `UpdateAssetFileDto` has no `label` |

**Confirmed against prod (`eureka_enterprises_v2_prod`, read-only):** all 17
`assets_files` rows had **0 labels populated** — the defect was real in
production, not theoretical.

### The two problems

1. **`label` was never sent or written** by add/update asset.
2. **`label` was a batch scalar, not per-file.** Even wired up as-is, uploading
   5 images with `label: "front view"` stamps *all 5* with "front view" — which
   does not meet the goal.

## 3. Target behavior (after)

One optional field on both DTOs, index-aligned with the uploaded files:

```
POST /assets            (multipart/form-data)
  assetFiles:       <binary>, <binary>, <binary>
  assetFileLabels:  '["Front view","Serial plate close-up","Wear on jaw"]'
```

- `assetFileLabels[i]` labels `assetFiles[i]` (upload order).
- Omitting `assetFileLabels` entirely reproduces the previous behavior exactly —
  **fully backward compatible**.

Response (unchanged shape, `label` now actually populated):

```json
"files": [
  { "id": "…", "fileKey": "…", "fileType": "ASSET_IMAGE", "label": "Front view" }
]
```

### Chosen shape

A **JSON array of strings**. Multipart text fields always arrive as strings, so
the value is parsed by a `@Transform` before validation — the same approach
`additionalData` already uses in these DTOs.

*Alternative rejected:* an array of per-file objects
(`[{label, fileType}, …]`). That was the earlier draft; it carried `fileType`,
which is now out of scope, and its nested-object validation added real
complexity for no remaining benefit (see §9).

## 4. Data model

**No migration required.** `assets_files.label` already exists as varchar(255)
nullable and is applied in prod (verified above).

## 5. Code changes

### DTOs

Added to **both** `CreateAssetDto` and `UpdateAssetDto`:

```ts
@ApiProperty({
  description:
    'Labels for the uploaded files, index-aligned with assetFiles (JSON array of strings). ' +
    'Entry i labels assetFiles[i]. Omit to leave the files unlabelled.',
  example: '["Front view","Serial plate close-up"]',
  required: false,
})
@IsOptional()
@Transform(parseJsonArray)
@IsArray()
@IsString({ each: true })
@MaxLength(255, { each: true })
assetFileLabels?: string[];
```

`@MaxLength(255, { each: true })` matches the column width, so an over-long label
is a 400 rather than a DB error. All validators are stock class-validator — no
nested DTO, no custom validation.

`parseJsonArray` lives in the shared utility folder
(`src/utils/utility/dto-transform.utils.ts`) rather than in the asset module,
since the JSON-string-field pattern is repo-wide. It parses the multipart string
and returns anything unparseable **untouched**, so `@IsArray` reports it instead
of the transform swallowing the error.

It is a free function, not a `UtilityService` method: property decorators run at
class-definition time, outside the Nest container, so they cannot resolve an
injectable.

### `AssetFilesService`

Added a per-file method; the existing scalar `create` became a thin delegate so
**all four prior call sites stayed untouched**:

```ts
async createMany(
  input: {
    assetMasterId: string; assetVersionId?: string; assetEventsId?: string;
    createdBy: string;
    files: { fileKey: string; fileType: string; label?: string | null }[];
  },
  entityManager?: EntityManager,
)
```

`create()` maps its `fileKeys` + scalar `label`/`fileType` onto `createMany` —
behavior identical to before.

### `AssetMastersService`

`create()` and `update()` now call `createMany`, zipping files with labels via
the private `buildAssetFilesToCreate`:

```ts
files: this.buildAssetFilesToCreate(assetFiles, createAssetDto.assetFileLabels)
```

It always sets `fileType: ASSET_IMAGE`. It lives on the service rather than in a
separate module, at the user's direction — the cost is that it cannot be unit
tested (see §10b).

### Controllers

`assetFileLabels` rides in on the existing `@Body()` DTO — **no controller
changes**. `@ValidateAndUploadFiles` continues to supply `assetFiles: string[]`.

### Length-mismatch rules

| Case | Behavior |
|---|---|
| more labels than files | **400** — a label for a file that was not uploaded is a client bug |
| fewer labels than files | Allowed — trailing files get `label: null` |
| `assetFileLabels` omitted | Allowed — previous behavior |

## 6. Index-alignment risk (explicitly accepted)

Alignment relies on `assetFiles[i]` preserving the client's upload order.
`FileFieldsInterceptor` preserves within-field order, so this holds — but it is a
positional contract: a client that reorders parts mislabels files. Accepted as
the cost of multipart; the alternative (client-generated per-file keys) would
require reworking `@ValidateAndUploadFiles` and is out of scope.

## 7. Consequences

1. `markLost` / `markRecovered` keep their hardcoded `fileType: OTHER` and remain
   unlabelled — out of scope.
2. `POST /asset-files` keeps its existing scalar-`label` behavior — out of scope.
3. Existing 17 prod rows keep `label = null`. No backfill; nothing to backfill from.
4. `fileType` remains hardcoded to `ASSET_IMAGE` on add/update, so a certificate
   uploaded there is still recorded as an image. **Known, deliberately
   out of scope** — see §9.

## 8. Test plan (dev DB, `eureka_enterprises_dev`)

Automated in `asset-file-labels.spec.ts` (9 tests, all passing) — request
contract only:

1. JSON string parses to a string array; an already-parsed array is accepted.
2. Omitting `assetFileLabels` validates cleanly (optional-field guard).
3. Label of 256 chars → **400**; exactly 255 → accepted.
4. Non-array payload, non-string entries, unparseable JSON → **400**.
5. `UpdateAssetDto` accepts the same shape and stays optional.

Requires the running app, **not yet exercised** (see §10b for why 6-8 are not
unit tested):

6. 3 files + 3 labels → 3 rows, correct distinct labels, correct order.
7. 3 files + 1 label → row 1 labelled, rows 2-3 `null`; no labels → all `null`.
8. more labels than files → **400**.
9. `PATCH /assets/:id` with 2 files + labels → new version, labels on the new
   version's files; prior version's files untouched.
10. `GET /assets/:id` → `label` present in `latestFiles` and `versionHistory[].files`.
11. `POST /asset-files` and `mark-lost` → unchanged (regression guard on the
    delegating `create`).

## 9. Scope decision: `fileType` excluded

An earlier draft made `fileType` settable per file, to fix a second defect: both
call sites hardcode `ASSET_IMAGE`, so certificates and invoices uploaded via
add-asset are recorded as images (prod: all 17 rows `ASSET_IMAGE`).

The user scoped this out and asked for label-only, minimal. Consequences:

- The mislabelled-`fileType` defect **remains open**. Worth a separate ticket.
- `latestFiles` filters to `ASSET_IMAGE`
  ([`asset-masters.service.ts:451-462`](../src/modules/asset-masters/asset-masters.service.ts#L451-L462));
  since every add/update file is still `ASSET_IMAGE`, nothing drops out of that
  array and **no existing response shape changes**.
- Dropping `fileType` let the design collapse from a nested DTO with
  `@ValidateNested` to a plain `string[]` with stock validators — a net
  simplification.

**Also deferred:** editing a label after upload. Impossible today (no PATCH on
asset-files, no `label` on `UpdateAssetFileDto`). Needs its own endpoint.

## 10. Implementation notes

### 10a. A `@Transform` + `@Type` conflict (found, then made moot)

The nested-object draft paired `@Transform` (to parse the JSON string) with
`@Type(() => AssetFileMetaDto)` (to instantiate entries). **These conflict:**
`@Transform` wins, entries stay plain objects, and `@ValidateNested` then
validates nothing — an unknown `fileType` and a 256-char label both passed, the
latter reaching the varchar(255) column as a DB error instead of a 400. Caught by
the tests, which failed on first run.

The label-only design has no nested objects, so the trap is gone entirely. Worth
recording for anyone who later adds an object array to a multipart DTO here.

### 10b. `buildAssetFilesToCreate` is a private service method, and untested

Placed on `AssetMastersService` at the user's direction, having accepted the
argument for a separate module but preferring it on the service.

**Consequence:** the index-alignment logic has **no unit test**. Importing
`AssetMastersService` into a spec throws `Class extends value undefined` — a
**pre-existing circular import** between `utils/base-entity` and
`users/entities/user.entity`. Not new: `role.service.spec.ts` fails identically
on a clean tree, as do the repo's other service specs.

So these are unverified by automated tests and need checking against a running
app: index alignment, the label/file count mismatch 400, and trailing-file
defaulting. The 9 remaining tests cover the request contract (parsing and
validation) only.

Fixing the underlying cycle would make this testable in place, and is worth a
separate ticket — it currently blocks unit testing of *every* service in the
repo.

## 11. Files touched

| File | Change |
|---|---|
| `utils/utility/dto-transform.utils.ts` | **new** — shared multipart JSON-array transform |
| `asset-masters/asset-file-labels.spec.ts` | **new** — 9 tests (request contract only) |
| `asset-masters/dto/create-asset.dto.ts` | + optional `assetFileLabels` |
| `asset-masters/dto/update-asset.dto.ts` | + optional `assetFileLabels` |
| `asset-masters/constants/asset-masters.constants.ts` | + `ASSET_FILE_LABELS_TOO_MANY` |
| `asset-files/asset-files.service.ts` | + `createMany`; `create` delegates to it |
| `asset-masters/asset-masters.service.ts` | `createMany` + helper in `create()` and `update()` |

No migration. No controller changes. No read-query changes. No new DTO class.

**Verification:** `tsc --noEmit` clean; eslint clean on all touched files (the
constants file carries 153 pre-existing CRLF-only prettier errors, left
untouched); 15/15 tests pass.
