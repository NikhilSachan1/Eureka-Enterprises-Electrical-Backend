# Spec: `current-status` user-resolution fallback + access guard

**Endpoint:** `GET /api/v1/attendance/current-status`
**Files:** `attendance.controller.ts`, `attendance.service.ts`
**Status:** proposed — awaiting approval

## Problem

The controller passes the query param `userId` straight to the service and never
falls back to the authenticated user:

```ts
return this.attendanceService.getEmployeeCurrentAttendanceStatus(query.userId, req.timezone);
```

The frontend does not send `userId`, so `userId` is `undefined`. In the service,
`attendanceRepository.findOne({ where: { userId: undefined, attendanceDate, isActive } })`
— TypeORM drops the `undefined` condition, and with no `ORDER BY` the query returns an
**arbitrary** company-wide attendance row (currently Raj Kumar / EE-0018) to **every**
caller. This is a cross-user PII leak (name, email, employeeId, company, contractor,
vehicle) — OWASP A01 / IDOR, confirmed live in prod.

Separately, the explicit `userId` override is intentional (admin/HR viewing another
employee) but has **no role check** — any employee can target anyone by id.

Reference: the sibling `GET /attendance` list endpoint already handles this correctly
via `AttendanceUserInterceptor` (forces `userIds = [req.user.id]` for EMPLOYEE/DRIVER,
rejects employees who pass ids). We mirror that intent here.

## Change

Keep the explicit-`userId` capability (admin/HR), add the fallback, guard the override.

### 1. Controller — resolve the target user

```ts
async getEmployeeCurrentAttendanceStatus(
  @Query() query: CurrentStatusQueryDto,
  @Request() req: RequestWithTimezone,
) {
  const PRIVILEGED = [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.HR];
  const isPrivileged = PRIVILEGED.includes(req.user.role);

  // Only privileged roles may view another user; everyone else is scoped to self.
  const targetUserId = query.userId && isPrivileged ? query.userId : req.user.id;

  return this.attendanceService.getEmployeeCurrentAttendanceStatus(targetUserId, req.timezone);
}
```

- No `userId` → **self** (fixes the leak).
- `userId` + privileged → that user (preserves intended admin behaviour).
- `userId` + non-privileged → **ignored**, scoped to self (soft, non-breaking; FE never
  sends `userId` today so nothing breaks). *Alternative:* throw `ForbiddenException` to
  match the list endpoint's stricter behaviour — call your preference.

Requires: widen `RequestWithTimezone.user` to include `role` (already present at runtime
from `auth.guard.ts`, just under-typed), and import `Roles`.

### 2. Service — defense in depth

Guard so a falsy `userId` can never run an unfiltered `findOne`:

```ts
async getEmployeeCurrentAttendanceStatus(userId: string, timezone?: string) {
  if (!userId) {
    throw new BadRequestException(ATTENDANCE_ERRORS.USER_ID_REQUIRED); // new constant
  }
  ...
}
```

## Out of scope
- No DB/schema change → no migration.
- No frontend change (FE already sends no `userId`; behaviour becomes correct-by-default).

## Test plan
1. Employee, no `userId` → own record (or "no record" message). ✅ leak closed.
2. Employee, `?userId=<other>` → own record (soft) / 403 (strict) — per chosen option.
3. HR/ADMIN/SUPER_ADMIN, `?userId=<other>` → that user's record. ✅ admin preserved.
4. Service called with falsy `userId` → `BadRequestException`, never an unfiltered query.
