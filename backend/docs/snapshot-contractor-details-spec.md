# Spec — Contractor city / state / GST in the assignment snapshot

**Status:** awaiting approval
**Scope:** `contractors[]` inside `assignmentSnapshot` only. Site and company are untouched.

## 1. Requirement

Every GET that returns `assignmentSnapshot` should carry, per contractor, `city`, `state` and
`gstNumber` alongside the existing `id` and `name`.

## 2. The two ways to do it

The lead's suggestion was: return the fields from the current-status API, have the FE send them back
at check-in, store what arrives.

**Recommendation: derive them on the server instead.** The FE round-trip is not needed, for four
reasons.

| | FE echoes the fields back | Server derives them (recommended) |
|---|---|---|
| FE work | New fields to read, hold, and re-send on check-in / regularize / force | **None** |
| When it starts working | Only after the FE ships, and only for clients that upgraded | **Immediately, for every new row and every client** |
| Trust | GST number arrives from the client and is stored verbatim — spoofable, and stale if the contractor master changed since the screen loaded | **Read from `contractors` at write time** |
| Places to change | Every FE screen that posts a snapshot | **One method** |

The third row is the one that matters. A GST number is master data with financial meaning; it should
not make a round trip through a mobile client that may have loaded the screen hours earlier.

## 3. Where the change goes

### 3.1 One write seam

All four write paths already funnel through `sanitizeAssignmentSnapshot`
([`:3311`](../src/modules/attendance/attendance.service.ts#L3311)):

| Path | Call site |
|---|---|
| Check-in | [`:166`](../src/modules/attendance/attendance.service.ts#L166) |
| Regularize | [`:518`](../src/modules/attendance/attendance.service.ts#L518) |
| Force attendance | [`:1235`](../src/modules/attendance/attendance.service.ts#L1235) |
| Bulk force | builds a per-user DTO that calls the single-force path above |

So a single enrichment step there covers every way a snapshot is ever written.

New private helper:

```ts
/**
 * Replaces the contractor entries with authoritative rows from the contractors table, keyed on the
 * ids the caller sent. City / state / GST are master data with financial meaning, so they are read
 * here rather than accepted from the client, which may have loaded its screen hours earlier.
 *
 * An id with no matching contractor is kept exactly as the client sent it — dropping it would
 * silently lose an entry the user can see on their own screen.
 */
private async enrichSnapshotContractors(
  snapshot: AttendanceEntity['assignmentSnapshot'] | undefined,
): Promise<AttendanceEntity['assignmentSnapshot'] | undefined>
```

Query — a single indexed lookup, only when the snapshot actually has contractors:

```sql
SELECT id, name, city, state, "gstNumber"
  FROM contractors
 WHERE id = ANY($1) AND "deletedAt" IS NULL
```

### 3.2 Called at the end, not the start

It runs on the **final** snapshot, after `applyEngineerContext`. That ordering matters for drivers:
a driver inherits `contractors` from his engineer's row, and if that row predates this change its
contractors are unenriched. Enriching last means the driver still gets the full fields.

### 3.3 Current status API

`getUserCurrentSiteWithDetails` ([`:2077`](../src/modules/attendance/attendance.service.ts#L2077))
builds the live fallback used by `/attendance/current-status` when there is no snapshot yet. Its
contractor query gains the same three columns, so the FE can display them on the check-in screen
whether or not a snapshot exists.

### 3.4 Read paths need no work

The list and detail GETs select the stored jsonb directly
([`attendance-queries.ts:126`](../src/modules/attendance/queries/attendance-queries.ts#L126)), so
the new fields surface automatically.

## 4. Types

`AttendanceEntity['assignmentSnapshot'].contractors`
([`attendance.entity.ts:57`](../src/modules/attendance/entities/attendance.entity.ts#L57)) and
`AssignmentSnapshotContractorDto`
([`attendance-action.dto.ts`](../src/modules/attendance/dto/attendance-action.dto.ts)) both gain:

```ts
city?: string;
state?: string;
gstNumber?: string;
```

Optional and `@IsOptional()` on the DTO deliberately: an FE that *does* send them keeps validating,
and the server simply overwrites them. That keeps the API and the app deployable independently — the
same reasoning already applied to `assignedEngineer` in this method.

No migration: `assignmentSnapshot` is jsonb.

## 5. Historical rows

**No backfill.** Rows written before this change keep their two-field contractors until that day's
snapshot is next written. Consistent with the same decision on driver-snapshot inheritance (§9 of
[`driver-snapshot-inherit-spec.md`](./driver-snapshot-inherit-spec.md)): a backfill rewrites
attendance rows in already-settled months for display benefit.

If the FE must not see a half-populated array, the alternative is a read-time join in the list
query — but that returns *today's* contractor master against a *past* attendance date, which
defeats the point of a snapshot. Flagging it rather than recommending it.

## 6. Risk

Low, and display-only. `resolveFoodCreditRecipient` reads only
`assignmentSnapshot.assignedEngineer.id`, so nothing here can change who gets paid. The only new
failure mode is the extra query; it is a PK-keyed `= ANY` lookup that is skipped entirely when the
snapshot has no contractors.

## 7. Test plan (dev DB)

1. Check in with contractors → stored snapshot has `city`, `state`, `gstNumber` from the master.
2. Client sends a **wrong** `gstNumber` → stored value is the master's, not the client's.
3. Client sends only `{id, name}` (current app behaviour) → fields still populated.
4. Client sends an id that no longer exists → entry kept as sent, nothing dropped, no crash.
5. Contractor with `gstNumber` NULL → field absent/null, no crash.
6. Snapshot with no contractors → no query issued, snapshot unchanged.
7. Driver inheriting from an **old** engineer row → contractors come back enriched (proves §3.2).
8. `/attendance/current-status` with no attendance row yet → live fallback carries the three fields.
9. List GET → the new fields appear for a row written after the change.
10. Regularize and force → same three assertions as (1).
