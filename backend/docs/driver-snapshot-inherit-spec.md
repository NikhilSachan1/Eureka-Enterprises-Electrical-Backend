# Spec — Driver Assignment Snapshot: inherit site/company/contractor from the engineer

**Status:** awaiting approval before implementation
**Date:** 2026-09-08
**Requested by:** user — show admin/HR the driver's assignment snapshot (assigned engineer, company,
contractor, site); whoever claims the driver becomes the assigned engineer and "remaining thing we
can get it from engineer attendance record assignment snapshot".
**Supersedes:** the freeze-on-approval design in
[`driver-assignment-snapshot-discussion.md`](./driver-assignment-snapshot-discussion.md), which was
scoped against a money bug that does not actually exist — see §2.

## 1. Goal

An admin/HR looking at a **driver's** attendance should see the full assignment context for that
day — assigned engineer, **site, company, contractor** — inherited from the engineer the driver was
paired with.

## 2. Correction: the money is already correct

Earlier analysis in the discussion doc claimed that when a driver checks in **before** the engineer
claims him, the food allowance is paid to the driver instead of the engineer. **That is wrong.**

`reRouteDriverAllowance`
([attendance.service.ts:2918](../src/modules/attendance/attendance.service.ts#L2918)) writes the
snapshot **unconditionally**, before the `isCredited` early return:

```ts
// Safe to write now: either no money has moved, or it is about to move in the same call.
await this.attendanceRepository.update({ id: attendance.id }, { assignmentSnapshot: snapshot, ... });
if (!isCredited) return 'not-credited';
```

And it is already invoked on both paths that can change a pairing:

| Path | Call site |
|---|---|
| Engineer check-in | [`:225`](../src/modules/attendance/attendance.service.ts#L225) `reRouteDrivers(affectedDrivers, …)` |
| Engineer regularize | [`:1021`](../src/modules/attendance/attendance.service.ts#L1021) same |
| Engineer's day rejected | `releaseHeldPairings` → `reRouteDrivers` |

So:

| Scenario | Actual behaviour today |
|---|---|
| Driver checks in first, engineer claims later | Engineer re-derived and **written to the driver's row** at claim time → approval reads it → **money to engineer** ✅ |
| Driver's day already approved, then engineer claims ("Scenario X") | `isCredited = true` → ledger **reversed and re-credited to the engineer**, with a **payroll guard** that refuses to move money after payroll is generated and records a review entry instead ✅ |
| Engineer's day later rejected | Pairings released, drivers' allowance routed back ✅ |

This is better than the "flag it and let HR regularize" option that was recommended for Scenario X.
**No money change is needed, and the ordering check is not required for correctness** — see §6.

## 3. The actual gap

`reRouteDriverAllowance` copies **only** the engineer:

```ts
const snapshot = { ...(attendance.assignmentSnapshot ?? {}) };
if (engineer) snapshot.assignedEngineer = engineer;
else delete snapshot.assignedEngineer;
```

`site`, `company`, `contractors` and `vehicle` are left as whatever the **driver** sent at his own
check-in — typically nothing, since a driver has no site context of his own to send.

That is the whole remaining requirement: inherit those fields from the **engineer's** snapshot.

## 4. Design

Extend the existing derivation rather than adding a parallel mechanism. One new helper on
`DriverAssignmentService`, beside `resolveAssignedEngineer`:

```ts
resolveAssignmentContext(driverId, workDate): Promise<{
  engineer: AssignedEngineerSnapshot | null;
  site?: ...; company?: ...; contractors?: ...; vehicle?: ...;
} | null>
```

One query: `driver_day_assignments` → engineer's `attendances` row for the same `workDate` → read
its `assignmentSnapshot`. Same joins and the same worked-status filter `resolveAssignedEngineer`
already uses, so the two can never disagree about whether a pairing resolves.

Then `reRouteDriverAllowance` builds:

```ts
snapshot.assignedEngineer = ctx.engineer;
snapshot.site        = ctx.site        ?? snapshot.site;
snapshot.company     = ctx.company     ?? snapshot.company;
snapshot.contractors = ctx.contractors ?? snapshot.contractors;
snapshot.vehicle     = ctx.vehicle     ?? snapshot.vehicle;
```

`??` rather than plain assignment: if the engineer's own snapshot lacks a field (his row was created
by the midnight cron, say), the driver keeps whatever he had rather than having it wiped.

When the pairing does **not** resolve, `assignedEngineer` is deleted as today and the inherited
fields are **left alone** — clearing them would erase context the driver may legitimately have sent
himself.

### Where it takes effect

No new call sites. The three existing ones already fire on every event that can change a pairing,
so inheritance rides along:

1. Engineer check-in with `assignedDrivers`
2. Engineer regularize (claims / releases / swaps)
3. Engineer's day rejected or regularized to a non-working status

### Money path untouched

`resolveFoodCreditRecipient` reads only `assignmentSnapshot.assignedEngineer.id`. Adding
site/company/contractor cannot change who gets paid. **This change is display-only** — which is
what makes it low risk compared with the superseded freeze design.

## 5. Historical rows

Rows whose pairing predates this change keep their existing snapshot until something touches that
day's pairing. Two options:

- **(a) Leave them** — recommended. The fields appear from the next pairing event onward. No data
  migration, no risk of overwriting real history.
- **(b) Backfill migration** — walk `driver_day_assignments`, re-derive, and update each driver's
  snapshot. Touches attendance rows for closed months, so it would need a payroll-locked guard of
  its own.

Recommend (a): the requirement is forward-looking reporting, and (b) rewrites settled months for
cosmetic benefit.

## 6. Ordering check (the lead's request) — optional, kept separate

The lead asked that **the engineer's attendance be approved before the driver's**, otherwise error.

Given §2, this is **not needed for money correctness** — engineer rejection already re-routes the
driver's allowance back, and claiming already re-routes it forward. Its remaining value is
operational: don't let someone settle a driver's day before the engineer's day is decided.

If implemented, it should be **narrow enough that it cannot deadlock**:

| Engineer's state for that day | Driver approval |
|---|---|
| Attendance exists and is still **PENDING** approval | **Blocked** — "approve the engineer's attendance first" |
| Already APPROVED | Allowed |
| REJECTED / absent / non-working | **Allowed** — pairing will not resolve, allowance correctly stays with the driver |
| No attendance row at all, or no pairing | **Allowed** — nothing to wait for |

Blocking only the genuinely-pending case is what prevents a driver being stuck forever behind an
engineer who left the company or whose day is never processed.

It fits the existing bulk shape with no contract change: `POST /attendance/approval` is already
bulk, and `handleBulkAttendanceApproval`
([`:2143`](../src/modules/attendance/attendance.service.ts#L2143)) already wraps each record in its
own try/catch, returning `{ result[], errors[] }`. A blocked driver simply lands in `errors[]` while
the rest approve.

## 7. Night shifts crossing midnight

The pairing is keyed on the engineer's `workDate`; a driver whose `attendanceDate` differs will not
match, so no engineer resolves and the allowance stays with the driver — the existing safe fallback.

Recommend documenting this rather than inventing cross-date matching now: any rule (±1 day, shift
window) risks matching the *wrong* day's engineer, which is worse than not matching. Revisit only if
it shows up in real data.

## 8. Test plan (dev DB, real API)

1. Engineer checks in with a driver; engineer's snapshot has site/company/contractor → driver's row
   gains **engineer + site + company + contractor**.
2. Driver checks in **first**, engineer claims later → same result after the claim.
3. Engineer's snapshot missing `company` → driver keeps his own `company`, nothing wiped.
4. Engineer releases the driver → `assignedEngineer` removed; inherited fields left as-is.
5. Two drivers under one engineer → both inherit the same context.
6. Engineer regularizes to a different site → both drivers' rows follow on the next pairing event.
7. **Money regression:** food allowance recipient unchanged in every case above — driver-first,
   engineer-first, claim-after-approval, and engineer rejected.
8. **Payroll guard regression:** claim after the driver's payroll is generated → snapshot and money
   left alone, review entry recorded (unchanged behaviour).
9. Driver with no engineer → snapshot and allowance exactly as today.

## 9. Open items

1. Should the **ordering check** (§6) be built at all, given it is not needed for correctness? If
   yes, confirm the narrow table in §6 so it cannot deadlock.
2. Should `vehicle` be inherited too, or only site/company/contractor? The requirement said
   "company, contractor, etc." — vehicle is in the snapshot shape but is arguably the *engineer's*
   vehicle, not the driver's.
3. Historical backfill — §5 option (a) or (b).
