# Spec — Admin-Set Password Reset for Employees / Drivers

**Status:** awaiting approval before implementation
**Date:** 2026-09-04
**Requested by:** user — "create an api in which admin hr operation manager an all , etc. they can
reset the password of any employee or driver. then they will set and share the password with
employee or driver."

## 1. Goal

Let a privileged user (Admin / HR / Operation Manager …) **set a new password directly** for an
employee or driver, then hand it over out-of-band. This covers the case the current flow cannot:
a **driver with no working email** cannot receive a reset link, so today they are simply stuck.

## 2. What already exists

| Flow | Behaviour |
|---|---|
| `POST /auth/forget-password` (public) | User asks for a reset link, emailed to them |
| `POST /auth/reset-password/:token` (public) | User sets their own password from the link |
| `POST /user/resend-password-link` | Admin re-sends the reset link **and the response contains `resetLink`**, so an admin can already copy/paste a link to a user |

So an admin can already trigger a *link*. What is missing is setting the password **value** — needed
when the target has no email access at all.

The existing self-service reset ([`auth.service.ts:332`](../src/modules/auth/auth.service.ts#L332))
does three things on success, and the new endpoint must do exactly the same:

```ts
password: this.utilityService.createHash(confirmPassword),   // bcrypt
passwordUpdatedAt: new Date(),                              // invalidates outstanding reset links
// then: revoke every non-revoked refresh token for that user
```

`passwordUpdatedAt` is not decorative — `resetPassword` compares it against the link's `iat` to
expire stale links, so setting it also kills any reset email already sitting in the target's inbox.

## 3. Endpoint

```
POST /auth/users/:userId/reset-password
permission: employee.reset-password

body:  { "newPassword": "Str0ng@Pass", "confirmPassword": "Str0ng@Pass" }
→ 200 { "message": "Password reset successfully" }
```

The response **never contains the password** — the caller typed it and already has it. Echoing it
would put a plaintext credential into logs, browser history and any HTTP cache.

### Why it lives on `auth`, not `user`

`AuthService` already holds `userService`, `refreshTokenRepository` and `utilityService`, so this is
zero new wiring. Putting it on `UserController`/`UserService` would need `RefreshTokenRepository`
inside `UserModule`, and since `AuthModule` already depends on `UserService`, that is a circular
module dependency requiring `forwardRef`.

### Password rules

Reuses the existing rules verbatim — `@MinLength(8)` plus
`/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/` — so an admin-set password is
never weaker than a self-set one.

Field names `newPassword` / `confirmPassword` are chosen deliberately: both are in
[`SENSITIVE_FIELDS`](../src/modules/audit-logs/constants/audit-log.constants.ts), so the request
audit log masks them as `[REDACTED]` automatically. **Naming them anything else would write a
plaintext password into `request_audit_logs`.**

## 4. Authorization — the part that matters

Two independent layers. The permission alone is **not** sufficient.

### Layer 1 — permission

New permission `employee.reset-password` (module `employee`, matching the existing
`employee.send-password-link` / `employee.edit` naming). Seeded by migration and granted to
**SUPER_ADMIN and ADMIN**; HR / Operation Manager / anyone else is granted it through the
role-permissions admin UI, exactly as `1860000000047` left role assignment out of scope.

### Layer 2 — target-role restriction (privilege-escalation guard)

**Without this, the feature is an account-takeover path.** If HR can reset *any* password, an HR
user can reset the SUPER_ADMIN's password and immediately sign in as SUPER_ADMIN. The permission
gate does not prevent this, because HR legitimately holds the permission.

So the target is restricted by the roles the **target** holds:

| Target holds | Resettable |
|---|---|
| only `EMPLOYEE` and/or `DRIVER` | ✅ yes |
| any of `SUPER_ADMIN`, `ADMIN`, `HR`, `MANAGER`, `OPERATION_MANAGER`, `ACCOUNTS` | ❌ **403** |

This matches the request as worded — "any **employee or driver**" — and keeps the blast radius at
non-privileged accounts. Privileged users keep using the email link flow for their own resets.

Also rejected:
- **self-reset** → 403. An admin resetting their own password should use the normal change/forgot
  flow; allowing it here muddies what the audit trail means.
- **archived / soft-deleted target** → 404, consistent with `findOne({ deletedAt: null })` elsewhere.

## 5. Behaviour on success

1. Hash with bcrypt via `utilityService.createHash`.
2. Set `passwordUpdatedAt = now` → any outstanding reset link for that user stops working.
3. **Revoke every active refresh token** for the target, so they are signed out of all devices and
   an old session cannot outlive the reset.
4. Audit: the `users` UPDATE is captured by the entity-audit subscriber, and the request by
   `request_audit_logs` with the password masked.

## 6. Migration

One migration, `…055-seed-employee-reset-password-permission`: inserts the
`employee.reset-password` permission and grants it to SUPER_ADMIN + ADMIN. Idempotent
(`NOT EXISTS` + `ON CONFLICT DO NOTHING`), mirroring `…050`.

No schema change — no new column is needed.

## 7. Deployment note

`PermissionsGuard` fails closed, so after deploy only SUPER_ADMIN and ADMIN can use it. **HR and
Operation Manager must be granted `employee.reset-password`** in the role-permissions UI before they
can, which is the one manual step.

## 8. Test plan (dev DB, real API)

1. Admin resets an EMPLOYEE's password → 200; target can sign in with the new password.
2. Old password no longer works → 401.
3. Target's existing refresh token is revoked → refresh fails after the reset.
4. Admin resets a DRIVER's password → 200.
5. Attempt to reset an **ADMIN's** password → 403 (escalation guard).
6. Attempt to reset a **SUPER_ADMIN's** password → 403.
7. Attempt to reset **own** password → 403.
8. Weak password (`abc`) → 400; mismatched confirm → 400.
9. Caller without `employee.reset-password` → 403.
10. Non-existent / archived userId → 404.
11. `request_audit_logs` row for the call shows `newPassword` as `[REDACTED]`, not plaintext.
12. An outstanding forget-password link for that user stops working after the admin reset
    (`passwordUpdatedAt` check).

## 9. Decisions needed

1. **Target scope** — restrict to targets holding only `EMPLOYEE`/`DRIVER` (recommended, matches the
   wording), or allow a tiered rule where SUPER_ADMIN/ADMIN may reset privileged users too while
   HR/OM may not? The strict version is safer and simpler; the tiered version is more convenient for
   a genuine admin but needs an explicit hierarchy.
2. **Notify the target by email that their password was changed** (without the password)? Standard
   security practice, and it gives the user a signal if it happened without their knowledge. Costs
   one email template. Recommended, but adds scope.
3. **Force the user to change it at next login?** There is no `mustChangePassword` column today, so
   this needs a migration and a sign-in check. Recommend **deferring** — the admin-set password is
   already strong and the user can change it themselves.

## 10. Adjacent gap found (not in scope)

`POST /user/resend-password-link` has **no `@RequiredPermission`** on the route even though the
`employee.send-password-link` permission exists in the DB — so any authenticated user can currently
trigger a reset link for any user id, and the response hands back a working `resetLink`. Same class
of gap as the site-vendor routes. Worth its own ticket; flagged here because it sits directly beside
this feature.
