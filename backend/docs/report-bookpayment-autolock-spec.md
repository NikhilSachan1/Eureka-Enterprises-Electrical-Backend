# Spec — Auto-approve + Auto-lock for Site Reports & Book Payments (with JMC-style Unlock Workflow)

**Status:** awaiting approval before implementation
**Date:** 2026-07-01
**Requested by:** lead

## 1. Goal

Make **site reports** and **book payments** behave like JMC / Site Invoice:

1. **Auto-approved + auto-locked at creation** (instead of today's "created PENDING → manual approve").
2. Give both a **full unlock workflow** — `unlock-request` (user) → `unlock-grant` / `unlock-reject` (admin) — as the only way to reopen a locked record for edits, exactly mirroring JMC and Site Invoice.

## 2. Current behavior (before)

| | Created as | Lock column | Reopen path today |
|---|---|---|---|
| Site Report | `PENDING`, needs manual `approve` | none | `reject` (only while PENDING) |
| Book Payment | `PENDING`, needs manual `approve` | none | `reject` (only while PENDING) |

For both, once `APPROVED`: `update`, `remove`, and `reject` are **all** blocked. So flipping create to `APPROVED` **without** an unlock path would make records permanently uneditable — that's why the unlock workflow is required.

## 3. Target behavior (after)

- **Create** → `approvalStatus = APPROVED`, `approvalBy = createdBy`, `approvalAt = now`, `isLocked = true`.
- **Locked record** → `update` / `remove` blocked (`CANNOT_EDIT_LOCKED`).
- **To edit:** `unlock-request` (needs a reason) → admin `unlock-grant` resets it to `PENDING` + `isLocked=false` (now editable) → user edits → user re-`approve`s (re-locks). Admin `unlock-reject` clears the request, record stays locked.
- **`approve`** endpoint stays — it's now the *re-lock* step used after an unlock (no longer part of the create flow).
- **`reject`** stays — reachable only while `PENDING` (i.e. after an unlock).

This is identical to the JMC lifecycle (`jmc.service.ts`) and Site Invoice.

## 4. Data model (TypeORM migrations only — per project rule)

Add to **both** `site_reports` and `book_payments` (mirrors `jmc` / `site_invoices`):

```
isLocked            boolean     NOT NULL DEFAULT false
unlockRequestedAt   timestamp   NULL
unlockRequestedBy   uuid        NULL   (FK → users, ON DELETE SET NULL)
unlockReason        text        NULL
```

**Backfill (in the same migration):** set `isLocked = true WHERE approvalStatus = 'APPROVED'`, so existing approved rows become unlock-able under the new workflow. Existing `PENDING` rows are left untouched (still normally editable). We do **not** retroactively approve any existing PENDING rows — only go-forward creates are auto-approved.

**Migrations (3):**
1. `18600000000XX-add-lock-columns-to-site-reports.ts` — 4 columns + FK + backfill.
2. `18600000000XX-add-lock-columns-to-book-payments.ts` — 4 columns + FK + backfill.
3. `18600000000XX-seed-report-bookpayment-unlock-permissions.ts` — seed `financials.site-reports.unlock` + `financials.book-payments.unlock`, map to `SUPER_ADMIN` + `ADMIN` (same pattern as `1857000000000-add-approval-lock-permissions.ts`).

## 5. Code changes

### Entities
- `site-report.entity.ts` / `book-payment.entity.ts`: add the 4 columns + `unlockRequestedByUser` `@ManyToOne(UserEntity)` relation.

### Services (both mirror `jmc.service.ts`)
- **create()**: set `approvalStatus=APPROVED, approvalBy=createdBy, approvalAt=now, isLocked=true`.
  - Book payment: bookedTotal increment at create is **unchanged**.
- **assertEditable() (update + remove guards):** block if `approvalStatus !== PENDING` **or** `isLocked` → `CANNOT_EDIT_LOCKED`.
- **requestUnlock(id, dto, requestedBy):** require `isLocked && approvalStatus===APPROVED` else `ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK`; set `unlockRequestedAt/By`, `unlockReason`.
- **grantUnlock(id, grantedBy):** require `unlockRequestedAt` else `UNLOCK_NOT_REQUESTED`; reset `approvalStatus=PENDING`, clear `approvalBy/At/Reason`, `isLocked=false`, clear unlock fields.
- **rejectUnlock(id, rejectedBy):** require `unlockRequestedAt` else `UNLOCK_REJECT_NO_REQUEST`; clear unlock fields, stays locked.

**Book-payment-specific guard:** `requestUnlock` **and** `grantUnlock` are blocked if `hasTransfer === true` → new error `CANNOT_UNLOCK_HAS_TRANSFER` ("a bank transfer exists — reverse it first"). A booked+transferred payment means money already moved; it must not be reopened.

**Book-payment rollups on unlock:** `grantUnlock` does **NOT** touch `bookedTotal` (unlike Site Invoice's `invoicedTotal`). Reason: book-payment `bookedTotal` is tied to the row *existing* (added at create, reversed only on `reject`/`remove`), not to its approval state. Going APPROVED→PENDING leaves the booking live, so the rollup stays; a later `update` re-adjusts by delta as it already does. (Site reports have no rollups — nothing to reverse.)

### Controllers (add 3 endpoints each, mirror `jmc.controller.ts`)
```
POST :id/unlock-request   RequiredPermission('financials.<mod>.update')   body: UnlockRequestDto { reason }
POST :id/unlock-grant     RequiredPermission('financials.<mod>.unlock')
POST :id/unlock-reject    RequiredPermission('financials.<mod>.unlock')
```
`<mod>` = `site-reports` / `book-payments`. Reuse shared `UnlockRequestDto` from `purchase-orders/dto/approval.dto.ts`. All unlock error/response strings already exist in `financial.constants.ts` (`CANNOT_EDIT_LOCKED`, `UNLOCK_NOT_REQUESTED`, `UNLOCK_REJECT_NO_REQUEST`, `ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK`, etc.) — only `CANNOT_UNLOCK_HAS_TRANSFER` is new (book-payment constants).

### Read endpoints
- Add `unlockRequestedByUser` to the `relations` arrays in `findAll`/`findById` and run it through `formatUser` (so the UI can show who requested an unlock). New lock columns come through automatically.

## 6. Consequences (explicitly accepted)

- **Book payment auto-approve** ⇒ every new book payment is **immediately eligible for a bank transfer** (the transfer path only checks `approvalStatus===APPROVED`). This removes the current manual review checkpoint before money can move. **Confirmed intended.**
- The standalone `approve` endpoint is no longer part of the create flow; it becomes the re-lock step after an unlock.

## 7. Test plan (live, on `eureka_enterprises_dev`)

For **each** of site report & book payment:
1. Run migrations; confirm 4 columns exist + existing approved rows now have `isLocked=true`; server recompiles.
2. Create one → assert response record is `APPROVED` + `isLocked=true`.
3. `PATCH` (edit) → **blocked** `CANNOT_EDIT_LOCKED`; `DELETE` → blocked.
4. `unlock-request` with reason → fields set; GET shows `unlockRequestedBy`.
5. `unlock-grant` → now `PENDING`, `isLocked=false`; `PATCH` edit now **succeeds**.
6. Re-`approve` → back to `APPROVED` + `isLocked=true`.
7. `unlock-request` again → `unlock-reject` → request cleared, still locked.
8. **Book payment only:** create → create a bank transfer against it (now possible immediately) → `unlock-request` → **blocked** `CANNOT_UNLOCK_HAS_TRANSFER`.
9. Permissions: a non-admin (has `.update` but not `.unlock`) can `unlock-request` but gets 403 on `unlock-grant`/`unlock-reject`.
10. `tsc --noEmit` clean throughout.

## 8. Open question / assumption
- Assumed existing **PENDING** rows are left as-is (not auto-approved on deploy). Only new creates auto-approve. Flagging in case the lead wants existing PENDING records bulk-approved too.
