# Spec — Site Project Manager: Vendor Assignment + Owner-Scoped Vendor CRUD

**Status:** implemented 2026-09-03
**Date:** 2026-09-03
**Requested by:** user — "in site we have vendor assignment right, so now there is a requirement in which vendor can also be assigned and CRUD (update and delete if he is doing it then only he can edit and delete) by site project manager"

## 1. Goal

A site's **Project Manager** should be able to:

1. **Assign / unassign vendors** to the sites he is PM of.
2. **Create vendors**, and **edit / delete only the vendors he created himself**.

## 2. Confirmed decisions

Agreed with the user before implementation:

| # | Decision |
|---|---|
| 1 | The "only creator can edit/delete" rule applies to the **vendor master record** (`vendors`), **not** to the assignment link. A `site_vendors` row has no editable fields — it is only added or removed. |
| 2 | **Admins keep an override** — SUPER_ADMIN / ADMIN (the existing bypass roles) can still edit and delete any vendor. The ownership restriction binds PMs only. |
| 3 | A PM may assign vendors only to sites where `site_allocations.role = 'Project Manager'` **and** `isCurrentlyAllocated = true`. Mirrors the existing PO-create rule. |

### The two-layer model

- **Vendor record** — has an owner (`createdBy`). Owner (or an admin) may edit/delete.
- **Vendor assignment** — no owner. Governed purely by "are you PM of *this* site".

So one vendor can be assigned to many sites, each site's PM managing their own
assignment, while the vendor's details stay editable only by its creator or an admin.

## 3. Current behavior (before)

| Layer | State before |
|---|---|
| `vendors` CRUD (`/vendors`) | Full CRUD, gated by `financials.vendors.create/view-list/update/delete`. `VendorEntity extends BaseEntity`, so **`createdBy` already existed** — but **no ownership check**: anyone holding `financials.vendors.update` could edit any vendor. |
| `site_vendors` (`/sites/:id/vendors`) | `GET` / `POST` / `DELETE` with **no `@RequiredPermission` on any route** and **no site-scope check** — any authenticated user could assign or unassign vendors on any site. Bare link table (`id, siteId, vendorId, createdAt`); no `createdBy`, no soft delete. |
| "Project Manager" | **Not a system role.** The `Roles` enum is SUPER_ADMIN / ADMIN / EMPLOYEE / MANAGER / OPERATION_MANAGER / HR / DRIVER / ACCOUNTS. PM is a **`site_allocations.role` string** (`PROJECT_MANAGER_SITE_ROLE = 'Project Manager'`), i.e. per-site. |

The missing authorization on `site_vendors` is a **pre-existing security hole**
that this change closes as a side effect.

## 4. Data model

**No schema migration.** `vendors.createdBy` already exists via `BaseEntity`, and
per decision 1 the link table needs no `createdBy`.

One **data** migration seeds the new permission rows (the established pattern —
see `1860000000047-seed-payment-request-edit-delete-permissions.ts`).

## 5. Target behavior (after)

### 5a. Vendor assignment — `/sites/:id/vendors`

| Route | Permission | Extra check |
|---|---|---|
| `GET :id/vendors` | `financials.site-vendors.view` | none (listing unchanged) |
| `POST :id/vendors` | `financials.site-vendors.assign` | bypass role **or** PM of this site |
| `DELETE :id/vendors` | `financials.site-vendors.unassign` | bypass role **or** PM of this site |

The PM check reuses `checkSiteCreateAccess` from
[`common/financials/site-access.helper.ts`](../src/modules/common/financials/site-access.helper.ts),
extended with a new `requirePm` option: unlike PO's `requirePmForCivil`, the PM
requirement here applies to **every** site type, not just Civil.

Existing behavior kept intact: the removal guard that blocks unlinking a vendor
which already has POs on that site still runs first.

### 5b. Vendor master — owner-scoped edit/delete

`update`, `remove` and `bulkDelete` now take the actor's `activeRole` and assert
ownership:

- bypass role (SUPER_ADMIN / ADMIN / MANAGER / OPERATION_MANAGER / HR) → allowed
- else `vendor.createdBy === actorId` → allowed
- else → **403** `You can only edit or delete vendors you created.`

`bulkDelete` checks per vendor and reports a per-row failure rather than aborting
the whole batch — consistent with how it already handles not-found and
active-association failures.

`create` is unchanged (already records `createdBy`). `restore` is unchanged —
gated by `financials.vendors.update` and treated as an admin recovery operation.

## 6. Code changes

| File | Change |
|---|---|
| `migration/1860000000050-seed-site-vendor-permissions.ts` | **new** — seeds 3 permissions + grants them to SUPER_ADMIN / ADMIN |
| `common/financials/site-access.helper.ts` | + `requirePm` option, + `PM_ONLY` reason |
| `site-vendors/site-vendor.controller.ts` | + `@RequiredPermission` on all 3 routes; passes actor id + activeRole |
| `site-vendors/site-vendor.service.ts` | + PM assertion on add/remove |
| `site-vendors/constants/site-vendor.constants.ts` | + `NOT_SITE_PM` error |
| `vendors/vendor.service.ts` | + `assertCanModify` ownership guard on update/remove/bulkDelete |
| `vendors/vendor.controller.ts` | passes `activeRole` into update/remove/bulkDelete |
| `vendors/constants/vendor.constants.ts` | + `NOT_OWNER` error |

## 7. Deployment note — permissions must be granted

`PermissionsGuard` **fails closed**. The three `financials.site-vendors.*`
permissions did not exist before, so once deployed:

- The migration grants them to **SUPER_ADMIN and ADMIN** automatically, so
  existing admin flows keep working with no manual step.
- **Every other role gets 403 on `/sites/:id/vendors` until an admin grants the
  permission** via the role-permissions UI — including the PM's own system role.

This is the one action required outside the code: grant
`financials.site-vendors.view` + `.assign` + `.unassign`, and
`financials.vendors.create/update/delete`, to whichever system role your PMs
hold (EMPLOYEE / MANAGER / …), or per user via `user_permissions`.

Because "Project Manager" is a site-allocation role and not a system role, the
permission grant is necessarily coarse — it is the **service-level
site-allocation check** that narrows it to "PM of this specific site". A user
granted `.assign` but not allocated as PM anywhere still cannot assign anything.

## 8. Consequences

1. `GET /sites/:id/vendors` now requires a permission where it previously
   required none — see §7. Any FE screen calling it needs the permission granted.
2. Vendor edit/delete becomes **more restrictive** for non-admin users who did
   not create the vendor. If a non-admin role today edits vendors it did not
   create, that stops working — intended by the requirement.
3. Deleting a vendor already assigned to any site remains blocked by the
   pre-existing `checkVendorHasSitesQuery` guard, independent of ownership.
4. No read-scoping added to vendor listing — a PM still sees all vendors, and
   should, since he must be able to assign vendors created by others.

## 9. Test results — real API against dev DB

Executed 2026-09-03 against `eureka_enterprises_dev` with the app running
locally. **20/20 assertions passed.** No unit tests, per the user's preference.

Fixtures: PM = EE-0009 (`site_allocations.role = 'Project Manager'` on
"765/400/220 Kv Pgcil, Bikaner 3"), system role EMPLOYEE, granted the new
permissions via `user_permission_overrides`; admin = SUPER_ADMIN.

| # | Case | Result |
|---|---|---|
| 1 | PM assigns vendor to **his** site | 201, link row created |
| 2 | PM assigns to a site he does **not** manage | 403 PM-only |
| 3 | PM unassigns from **his** site | 200, link row removed |
| 4 | PM unassigns from a site he does **not** manage | 403 PM-only |
| 5 | Unassign a vendor holding POs on that site | 400 (pre-existing guard) |
| 6 | PM creates a vendor | 201, row persisted, `createdBy` = PM |
| 7 | PM edits **his own** vendor | 200 |
| 8 | PM edits a vendor created by ADMIN | 403 not-owner |
| 9 | PM deletes a vendor created by ADMIN | 403 not-owner |
| 10 | ADMIN edits **and** deletes a PM-created vendor | 200 both (override works) |
| 11 | `bulkDelete` [own, admin-owned] | 200; own deleted, admin-owned rejected per row |
| 12 | No auth token on site-vendor routes | 401 |

All test rows (vendors, links, per-user permission grants) were removed
afterwards; dev is back to its prior state with only the migration's permission
rows kept.

### Test-harness gotcha worth recording

The first run appeared to show writes being silently discarded — `POST /vendors`
returned **201** with a valid id, but no row existed in any database. Cause: the
harness sent a non-UUID `X-Correlation-Id`. `entity_audit_logs.correlationId` is
a `uuid` column and `EntityAuditSubscriber` inserts **inside the same
transaction** as the entity write, so the audit insert failed, aborted the
transaction, and the following `COMMIT` was discarded by Postgres — while the
subscriber swallowed its own error, leaving the 201 intact.

**This is a latent application bug, not a test artifact** — see §13.

## 13. Separate bug found while testing (NOT fixed here)

A malformed `X-Correlation-Id` header causes **silent data loss with a 201
response**. Out of scope for this change; raised for its own ticket.

**Mechanism.** `EntityAuditSubscriber` writes to `entity_audit_logs` in the same
transaction as the entity insert, and `correlationId` is a `uuid` column. Any
non-UUID header value makes that insert fail, which aborts the transaction —
Postgres then discards the `COMMIT`. Because the subscriber catches and logs its
own failure, the request still returns success:

```
START TRANSACTION
INSERT INTO "vendors" ...                 -- succeeds
INSERT INTO "entity_audit_logs" ...       -- FAILS: invalid input syntax for type uuid
COMMIT                                    -- aborted tx => silently rolled back
-> HTTP 201 {"message":"Vendor has been created successfully.", "id": "..."}
```

`RequestAuditInterceptor` fails the same way, but harmlessly — it runs in its own
transaction after the response.

**Impact.** Any client sending a non-UUID correlation id loses every write while
being told it succeeded. `HeaderValidationGuard` only checks presence, not
format, so nothing rejects the bad value at the edge. This affects **all**
audited entities, not just vendors.

**Fix options** (pick one, needs its own spec):
1. Validate `X-Correlation-Id` as a UUID in `HeaderValidationGuard` → 400 at the edge.
2. Coerce/ignore a non-UUID correlation id in the audit subscriber, so auditing
   degrades instead of destroying the write.
3. Move audit writes out of the caller's transaction.

Option 2 alone is the safest minimum: an audit-logging failure should never
discard business data. Option 1 as well, so bad clients get told.

## 14. Addendum — FE gating endpoint (`assignable sites`)

**Added 2026-09-04.** The FE vendor section is a **global screen, not inside a site page**, so
there is no `siteId` in context to check against. A per-site `can-manage` check (the PO
`can-create` pattern) therefore does not fit: the user also has to *pick* a site to assign to.

### Endpoint

```
GET /sites/vendors/assignable
→ { "allowed": true, "sites": [ { "id": "…", "name": "…" } ] }
```

One call serves both FE needs:

| FE need | From |
|---|---|
| Show / hide the vendor section | `allowed === false` → hide |
| Site dropdown for assign / unassign | `sites` |

### `allowed` logic

| Case | allowed | sites |
|---|---|---|
| `activeRole` in `SITE_ACCESS_BYPASS_ROLES` (SUPER_ADMIN, ADMIN, MANAGER, OPERATION_MANAGER, HR) | `true` | all non-deleted sites |
| ≥1 current allocation with `role = 'Project Manager'` | `true` | just those sites |
| Neither | `false` | `[]` |

Non-bypass users get **only their PM sites** — a site where they are `Engineer` is deliberately
excluded, because assigning there would 403. That is the whole point of the endpoint: the dropdown
can only contain sites the user can actually act on.

`allowed` is kept as its own field rather than letting FE infer `sites.length > 0`, for the one
case where they differ: an admin on a system with no sites yet gets `allowed: true, sites: []` —
the section should show, even with an empty dropdown.

The bypass-role list and the PM role string both come from
[`site-access.helper.ts`](../src/modules/common/financials/site-access.helper.ts), the same source
the POST/DELETE enforcement uses, so gating and enforcement cannot drift apart. FE never hardcodes
`'Project Manager'`.

### Route path

`/sites/vendors/assignable`, **not** `/vendors/assignable-sites` as first sketched. Two reasons:

1. `/vendors/assignable-sites` would live on `VendorController`, which would need
   `SiteVendorService` — and `SiteVendorModule` already imports from the vendors module, so that
   is a circular module dependency needing `forwardRef`.
2. It returns **sites**, so `/sites/...` is the more accurate resource.

No route collision: `sites/:id/vendors` requires the literal `vendors` in the 3rd segment, while
this route has `assignable` there. It is still declared before the `:id` routes as a precaution.

### Permission

`financials.site-vendors.view` — the same permission the list already needs. FE must treat a
**403 as "hide the section"**, not as an error, since that is what a role without the grant sees.

### FE contract

```
if (403 || !allowed)  → hide vendor section
else                  → show section; use `sites` for the site picker
```

## 15. Addendum — completed sites excluded

**Added 2026-09-04.** Neither `getAssignableSites` nor the assign/unassign enforcement looked at
`sites.status`, so a finished site was offered in the picker and accepted by the API.

Confirmed on dev, not theoretical: the test PM's only site
(`765/400/220 Kv Pgcil, Bikaner 3`) is **`completed`** and still came back in `sites`, and the
admin branch returned all 8 sites including 3 `completed` + 1 `work_completed`.

Why the existing invariant does not cover it: [`site.service.ts:658`](../src/modules/sites/site.service.ts#L658)
blocks the *transition to* `hold`/`work_completed`/`completed` while any `isCurrentlyAllocated`
allocation exists — but nothing stops allocations existing afterwards, and dev already holds 2
violating rows (one with a PM). The guard protects the transition, not the steady state.

### Rule

Only **`completed`** is excluded. `hold` and `work_completed` are deliberately left alone for now
(user's call — a held site may resume).

| Path | Behaviour on a `completed` site |
|---|---|
| `GET /sites/vendors/assignable` | Site omitted from `sites` — both PM and bypass branches |
| `POST /sites/:id/vendors` (assign) | **403** — applies to everyone, admins included |
| `DELETE /sites/:id/vendors` (unassign) | **Allowed** — a vendor wrongly attached to a closed site must stay removable |

The status check is applied to the picker **and** the enforcement. Picker-only would let an admin
(who bypasses the allocation check) still assign to a closed site via a direct call, which is
exactly the gating/enforcement drift this spec has avoided elsewhere.

Unassign is deliberately asymmetric: blocking it would strand bad data on closed sites with no
cleanup path.

### Known data issue (not fixed here)

2 dev sites are `completed` yet still carry `isCurrentlyAllocated = true` allocations. That is a
data-quality problem predating this change, worth checking on prod:

```sql
SELECT s.status, s.name, count(*) AS current_allocs
  FROM sites s
  JOIN site_allocations sa ON sa."siteId" = s.id
                          AND sa."isCurrentlyAllocated" = true AND sa."deletedAt" IS NULL
 WHERE s."deletedAt" IS NULL AND s.status IN ('hold','work_completed','completed')
 GROUP BY s.status, s.name;
```
