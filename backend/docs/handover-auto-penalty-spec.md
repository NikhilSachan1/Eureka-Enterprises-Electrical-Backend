# Asset / Vehicle Handover — 48-Hour Auto Penalty & Reassignment

Status: **built and verified on dev** (41 assertions, all passing). Shipping **disabled** — the
config switch below has to be turned on deliberately. Read *Before switching it on* first.

## The rule

A handover is initiated to someone. If that person does nothing — no Accept, no Reject, no Cancel —
for 48 hours, the system acts on their behalf:

```
Initiate → 48h no action → ₹500 penalty on the receiver → same asset/vehicle assigned to them
                                                        → initiate images carried forward
```

The existing Accept / Reject / Cancel paths are not touched. Nothing about them changes.

## Decisions already taken

| Question | Decision |
|---|---|
| Penalty kis par? | The **receiver** (`toUser` of the initiate event) — "jis employee ke liye initiation create ki gayi thi". |
| Penalty ka accounting type | `CREDIT`, because of the ledger direction below. |
| Penalty "feel" | New `expenseEntryType: 'penalty'` tag. UI keys off the tag, not the amount sign. |
| Category | New expense category `asset_penalty` ("Asset Penalty") — gives the filter for free. |
| On/off | Config-driven, ships **disabled**. No deploy needed to switch it on or off. |

### Why the penalty is a CREDIT and not a DEBIT

This ledger runs in the opposite direction to the everyday meaning of the words
(`expense-tracker.service.ts:714`):

```
closingBalance = openingBalance + credit − debit
```

- **DEBIT** = an entry in the employee's favour — their own spend, or food allowance earned
  (`attendance.service.ts:3485`). It pushes the balance down, i.e. the company owes them more.
- **CREDIT** = money going back the other way — a settlement paid out, or a recovery charged.
  **Asset loss recovery is already a CREDIT** (`asset-masters.service.ts:870`).

A penalty reduces what the company owes the employee, so it is a CREDIT. Recording it as a DEBIT
would *increase* what the company owes them — the opposite of a penalty.

### Why a tag and not a new transaction type

`credit − debit` appears in eight balance/summary/opening-balance queries. A third transaction type
would silently fall out of all of them. A negative `amount` would corrupt every `SUM()`.

The codebase already solves exactly this: `ExpenseEntryType.CREDIT_BONUS` is a DEBIT row tagged with
a different flavour (`expense-tracker.service.ts:386`). `PENALTY` is its mirror.

`expenseEntryType` is **already selected in the list query and returned in the response**
(`expense-tracker.queries.ts:133`, `expense-tracker.service.ts:786`), so the FE needs no new field:

```jsonc
{
  "category": "asset_penalty",
  "transactionType": "credit",      // ledger stays correct
  "expenseEntryType": "penalty",    // what the UI switches on
  "amount": 500,
  "description": "₹500 penalty — no action taken on the handover of Drill Machine (SN-8821) within 48 hours.",
  "transactionId": "<assetEventId>" // traceable back to the event
}
```

FE: `expenseEntryType === 'penalty'` → red row, `− ₹500`, "Penalty" chip. Everything else unchanged.

### The "Asset Penalty" filter

Nothing new to build on the server. The expense list already takes `categories[]`, so
`GET /expenses?categories=asset_penalty` works the moment the category exists, and `totalRecords`
respects it.

The dropdown the FE builds that filter from is the `expense_categories` config, which migration
`…067` seeds into:

```jsonc
{ "name": "asset_penalty", "label": "Asset Penalty", "icon": "alert-triangle",
  "isSystemGenerated": true, "allowedRoles": ["SUPER_ADMIN", "ADMIN", "HR"] }
```

**One thing for the FE:** that single list feeds both the *create* dropdown and the *filter*
dropdown. `isSystemGenerated: true` means "nobody types this by hand" — it should be hidden from
**create**, but it must stay in the **filter**, otherwise the category exists and is unfilterable.
`asset_loss_recovery` carries the same flag, so whatever the FE already does for that applies here.

## The switch (plug and play)

New configuration key, same pattern as `asset_expiring_soon_days`
(`master-constants.ts:41`, read in `asset.cron.service.ts:222`):

```jsonc
// module: ASSET, key: handover_auto_penalty
{
  "enabled": false,          // ships OFF — BA turns it on from the config screen
  "hours": 48,
  "amount": 500,
  "modules": { "asset": true, "vehicle": true }
}
```

The cron reads this as its **first** statement. `enabled: false` → it logs and returns without
touching a single row. Turning it off later stops it immediately; rows already written stay as they
are. `hours` and `amount` are tunable without a deploy, and either module can be switched off on its
own. A missing or unreadable config is also treated as off.

### Turning it on

From the configuration screen: module **asset**, key **handover_auto_penalty**, set `enabled` to
`true`. Or directly:

```sql
UPDATE config_settings cs
   SET value = jsonb_set(cs.value::jsonb, '{enabled}', 'true'), "updatedAt" = NOW()
  FROM configurations c
 WHERE cs."configId" = c.id
   AND c.key = 'handover_auto_penalty'
   AND cs."isActive" = true;
```

It takes effect on the next scheduled run; to see it immediately, trigger it by hand with
`POST /admin/cron/trigger { "jobName": "HANDOVER_AUTO_PENALTY" }` (add `"dryRun": true` to see what
it would do first).

## The cron

- Name `HANDOVER_AUTO_PENALTY`, type `CronJobType.ASSET`, wrapped in the existing
  `cronLogService.execute(...)` so it shows up in cron-logs like every other job.
- **Twice a day, 10:00 AM and 6:00 PM IST** (`30 4,12 * * *`, a new `TWICE_DAILY_10AM_6PM_IST`
  entry). Once daily would leave a window that closes just after the run waiting almost a full day;
  twice bounds that to ~16 hours, and both runs sit in working hours because each one can message
  the employee. The 48-hour window itself is exact — the schedule only decides how soon after it
  closes the penalty is noticed.
- Manually runnable through the existing `POST /admin/cron/trigger`, which also supports `dryRun` —
  that is how we will verify on dev before switching it on.

### Which rows it picks

"Still pending" already has a definition in the service: the **last** event on the asset is
`HANDOVER_INITIATED` (`asset-events.service.ts:124`). The cron uses the same rule:

```sql
FROM assets_events e
WHERE e."eventType" = 'HANDOVER_INITIATED'
  AND e."deletedAt" IS NULL
  AND e."createdAt" <= now() - ($1 || ' hours')::interval
  AND NOT EXISTS (                       -- nothing happened after it
    SELECT 1 FROM assets_events later
     WHERE later."assetMasterId" = e."assetMasterId"
       AND later."createdAt" > e."createdAt"
       AND later."deletedAt" IS NULL
  )
```

Vehicles: the same query against `vehicles_events` / `vehicleMasterId`.

### What it does per row — one transaction

1. Create a `HANDOVER_AUTO_ACCEPTED` event (new event type, seeded into the `asset_event_types` /
   `vehicle_event_types` config so the history screen can label it), with
   `metadata: { autoAccepted: true, initiatedEventId, penaltyExpenseId, hours, amount }`.
2. **Carry the images forward** — copy the initiate event's `assets_files` rows onto the new event.
   Same `fileKey`s, new `assetEventsId`. Nothing is re-uploaded and nothing is moved in storage.
3. Update the active version: `status = ASSIGNED`, `assignedTo = <receiver>` — identical to what
   Accept does (`asset-events.service.ts:322`).
4. `createSystemExpense({ userId: receiver, category: 'asset_penalty', amount, transactionType:
   CREDIT, expenseEntryType: PENALTY, referenceId: eventId, referenceType:
   'ASSET_HANDOVER_AUTO_PENALTY' })` — already approved, already attributed to the system user.

**Idempotency** needs no new column: once step 1 writes the new event, that asset's last event is no
longer `HANDOVER_INITIATED`, so the next run cannot pick it again. The expense's `transactionId`
(= event id) is the second line of defence.

## Code touched

| File | Change |
|---|---|
| `expense-tracker.constants.ts` | `ExpenseEntryType.PENALTY = 'penalty'` |
| `expense-tracker.service.ts` | `createSystemExpense` gains `expenseEntryType` and an optional `EntityManager` (today it hardcodes `FORCED` and runs outside the caller's transaction) |
| `asset-masters.constants.ts` / vehicle equivalent | `HANDOVER_AUTO_ACCEPTED` event type, penalty category + reference-type constants |
| `scheduler/constants/scheduler.constants.ts` | `HOURLY` schedule, `HANDOVER_AUTO_PENALTY` cron name |
| `scheduler/crons/handover-penalty.cron.service.ts` | **new** — the job, both modules |
| `scheduler/queries/` | **new** — the two selection queries |
| `cron-trigger` constants + service | registers `HANDOVER_AUTO_PENALTY` so it can be run by hand from `POST /admin/cron/trigger`, including `dryRun` |
| `migration/1860000000067-seed-handover-auto-penalty.ts` | seeds the `asset_penalty` expense category (same idiom as `1822000000000`), the `handover_auto_penalty` config (disabled), and the new event type in both lists |

No schema change. Everything is config seeds plus one new cron file.

Run on dev; **not run on production**.

## Verified on dev

41 assertions, all green, against real asset and vehicle fixtures:

- **Off** — the cron logs that it is disabled and touches nothing, including a handover 60 hours old.
- **On** — the stale asset gets a `HANDOVER_AUTO_ACCEPTED` event carrying `initiatedEventId`, the
  version flips to ASSIGNED against the receiver, and both initiation images are carried onto the
  new event while the initiation keeps its own rows (same `fileKey`s — nothing re-uploaded).
- **The penalty** — ₹500, `credit`, `expenseEntryType: 'penalty'`, auto-approved, raised by the
  system user, `transactionId` pointing at the event.
- **Left alone** — a handover still inside the window, and one that was already rejected.
- **Vehicles** — same event, assignment, image carry-forward and penalty.
- **Re-run** — a second run charges nothing more.
- **Undo** — an admin rejecting the penalty deactivates the row and writes a rejected version, so it
  drops out of the balance.
- **Per-module switch** — `modules.asset: false` leaves assets alone while vehicles still run.

## Settled

1. **Vendors — not applicable.** A handover's receiver is always a user; "vendor" in the original
   note was a slip. Nothing to build for it.
2. **Archived employees are penalised too**, same as loss recovery, with a note in the description
   saying the employee is archived.
3. **Reversal needs no new code.** An admin rejects the penalty through the existing expense
   approval endpoint. `approved → rejected` is already supported
   (`expense-tracker.service.ts:1129`): the row is flipped to `isActive: false` and a new `rejected`
   version is written. Every balance query filters on `isActive = true AND approvalStatus =
   'approved'`, so the penalty leaves the balance by itself. A rejection comment is mandatory, which
   gives the audit trail. The "creator cannot reject" rule does not block anyone, because the
   creator is the system user.
4. **48 hours = calendar hours.** Sundays and holidays count.
5. **The receiver is notified** when the penalty lands, through the existing WhatsApp/email helpers.

## Before switching it on — read this

**The day the switch is flipped, every handover already pending past the window is penalised at
once.** The cron has no notion of "from today onwards"; it looks at what is pending right now. On
dev this was not theoretical — enabling it during testing immediately picked up five genuinely
stale handovers (three assets, two vehicles), one of them pending since June, and penalised their
receivers. They were restored afterwards.

So on UAT and production, before `enabled` is set to true:

1. Count what would be hit — pending handovers older than the window:
   ```sql
   SELECT count(*) FROM assets_events e
    WHERE e."eventType" = 'HANDOVER_INITIATED' AND e."deletedAt" IS NULL
      AND e."createdAt" <= NOW() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM assets_events l
                       WHERE l."assetMasterId" = e."assetMasterId"
                         AND l."deletedAt" IS NULL AND l."createdAt" > e."createdAt");
   -- same against vehicles_events / vehicleMasterId
   ```
2. Get those cleared by hand (accept / reject / cancel), **or** accept that they will all be
   penalised on the first run.

A safe rollout is: clear the backlog, then enable. There is deliberately no "only handovers
initiated after date X" rule — it would be a second switch to explain and to get wrong.

## Not double-penalising

Three layers, in order of importance:

1. **The selection rule is itself the guard.** "Pending" means the asset's *last* event is
   `HANDOVER_INITIATED`. The moment the auto-accept event is written, that stops being true, so the
   next run cannot select the row. No `penaltyApplied` flag column is needed.
2. **One transaction** covers the event, the file copies, the version update and the penalty. A
   failure part-way rolls the whole thing back rather than leaving an assignment with no penalty (or
   the reverse). This is why `createSystemExpense` has to accept an `EntityManager`.
3. **A re-check inside the transaction.** If two runs ever overlap they could both read the same
   pending row before either writes. Inside the transaction the asset is locked and the "last event
   is still `HANDOVER_INITIATED`" condition is verified again; the loser skips silently.
