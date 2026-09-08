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

## 9. Decisions taken

| Open item | Decision | Rationale |
|---|---|---|
| Inherit `vehicle` too? | **Yes** — inherited | Confirmed by the lead. The driver drove the engineer's vehicle that day, so it is the more useful of the two readings. Verified inherited on dev. |
| Historical backfill (§5) | **No backfill** — option (a) | Requirement is forward-looking reporting; a backfill rewrites attendance rows in already-settled months for cosmetic benefit. |
| Ordering check (§6) | **Not built** | §2 established the money is already correct without it, so its only value is operational. Building it would block a driver behind an engineer whose day may never be processed. The narrow table in §6 stands as the design if it is ever wanted. |

## 10. Force attendance had the same pairing gap

Regularize synced pairings; **force attendance did not**. An admin forcing an engineer's day with
`assignedDrivers` wrote the snapshot but never wrote `driver_day_assignments`, so the driver's own
row never inherited anything and the allowance never re-routed.

Force now mirrors regularize: pairings are synced inside the transaction and `reRouteDrivers` runs
after it commits.

**Bulk force is deliberately excluded.** `handleBulkForceAttendance` applies one payload to many
users, so a shared `assignedDrivers` would mean several engineers claiming the same driver on the
same day — the partial unique index rejects the second, aborting the batch. Bulk force therefore
strips `assignedDrivers` and logs a `[driver-pairing]` warning. Pair drivers through single force or
regularize.

## 11. Two regularize bugs found from live dev data

Both surfaced from the reported case (engineer Nikhil + driver Siddhika, both marked absent by the
cron, then regularized).

**Bug A — the re-route could not see its own transaction.** `reRouteDrivers` was called *inside*
`this.dataSource.transaction(...)`, but it reads on its own connection. The engineer's new
`present` status was still uncommitted, so `resolveAssignmentContext` — which requires the
engineer's day to be a worked status — found nothing, and the driver's snapshot stayed `{}`.
Fixed by capturing the transaction result and re-routing after it commits:

```ts
const result = await this.dataSource.transaction(/* ... */);
await this.reRouteDrivers(affectedDrivers, existingAttendance.attendanceDate, userId);
return result;
```

**Bug B — sanitize was skipped on the driver's own regularize.** `sanitizeAssignmentSnapshot` only
ran when the caller supplied a snapshot (`isSnapshotCorrection`). Regularizing the *driver* without
one skipped resolution entirely, so a driver who was already paired never gained his engineer.
Sanitize now always runs, falling back to the stored snapshot:

```ts
const resolvedSnapshot = await this.sanitizeAssignmentSnapshot(
  userId,
  isSnapshotCorrection ? regularizeAttendanceDto.assignmentSnapshot : previousSnapshot,
  existingAttendance.attendanceDate,
);
```

Verified against the real dev rows: 4/4 assertions, including that the fixed path would have
populated engineer + site + company + vehicle for that exact pair.

## 12. Non-working day while still linked

A driver cannot be absent *and* out with an engineer on the same day. Previously nothing enforced
this: marking the driver absent emptied his own snapshot while he stayed listed as an assigned
driver in the engineer's snapshot, and stayed holding the unique-index slot.

`handleOwnPairingForNonWorkingDay` is the mirror of `releaseHeldPairings` (which only handled the
other direction — an engineer going non-working gives up the drivers he holds). It has two modes,
because the two kinds of caller need opposite things:

| Path | Mode | Behaviour |
|---|---|---|
| Regularize to absent / leave / LWP / holiday | `throw` | `DRIVER_LINKED_CANNOT_MARK_NON_WORKING`, naming the engineer |
| Force attendance to a non-working status | `throw` | same |
| Approval **reject** (status → absent) | `throw` | same; in a bulk approval it lands in `errors[]` and the rest still process |
| End-of-day cron marking absent | `release` | unlinks, logs, re-routes the allowance |

Manual paths throw because the contradiction is between *two people's records* — the engineer said
the driver was with him, an admin now says he was absent — and silently overriding either one hides
a data-entry mistake. The error names the engineer so the fix is obvious: remove the driver from
that attendance first.

Crons release instead: there is no human in the loop to answer an error, and a throw would abandon
the rest of the batch.

**Where the cron re-routes matters.** The end-of-day cron wraps its whole batch in one
`dataSource.transaction`, so re-routing inside it would hit exactly the isolation trap of Bug A.
`releaseOwnPairingForSystemNonWorkingDay` therefore only unlinks and returns the freed driver ids;
the cron accumulates them across both absent paths (`markAbsentNotCheckedInUsers` and
`createAbsentForMissingUsers`) and calls `reRouteReleasedDrivers` after the transaction commits.

`createAbsentForMissingUsers` needs the check too: a driver can be claimed for the day without ever
having an attendance row of his own.

The **morning** cron (`buildAttendanceRecord` → holiday / leave / LWP) needs no check. It runs at
midnight of the day it creates rows for, and a pairing for a date requires the engineer to already
have attendance for that date — which regularize and force both refuse for future dates. No pairing
can exist yet.

### Fixing a blocked case

| Situation | What to do |
|---|---|
| Driver was genuinely absent; engineer's day is wrong | Regularize the **engineer** and remove the driver from `assignedDrivers`. The driver is freed, then mark him absent. |
| Engineer's day is right; the driver's absence is wrong | Don't mark him absent — regularize him to present. He keeps the inherited context and the allowance stays routed to the engineer. |
| Driver on approved leave, engineer claimed him by mistake | Regularize the engineer to drop the claim, then apply the leave. |
| Cron already marked the driver absent | Nothing to do — the cron released the link and re-routed. Re-claim him via the engineer's regularize if he did work. |

## 13. Verification (dev only)

- Snapshot inheritance: 12/13 assertions (the skipped one needed a second DRIVER account).
- The two regularize bugs, reproduced and fixed against the real reported rows: 4/4.
- Non-working-day rule, both modes, mirroring `findHolder` / `release` SQL exactly: 16/16 —
  including that the refused attempt writes nothing, that release is idempotent, that a freed driver
  is immediately re-claimable, and that `SYSTEM_USER_ID` is usable as `deletedBy`.

Still outstanding: an end-to-end run against the booted app. Everything above was asserted at the
SQL-contract level on dev, plus `tsc` and `eslint` clean.

## 14. Open items

1. Engineer's day is never approved → should the driver's approval be blocked, or is an override
   needed? (Parked by the lead.)
2. Engineer's day is rejected → should the driver still be approvable? (Parked.)
3. Night shifts crossing midnight (§7) — documented as an accepted limitation, not handled.
