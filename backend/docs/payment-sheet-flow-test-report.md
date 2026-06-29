# Payment Sheet — Approval Flow Test Report

> Scope: end-to-end verification of the payment-sheet approval flow
> (`OPERATION_MANAGER → HR → ADMIN → ACCOUNTS`) against the live dev database,
> for **single-role** and **multi-role** users. Driven through the real HTTP API.
>
> Environment: local backend `http://localhost:3333/api/v1` · Date: 2026-06-29

---

## 1. Background — why the FE was seeing access errors

The FE reported: *"approval flow causing errors; even users with valid role access get 'user doesn't have access' errors."*

Root cause found during testing:

1. **The `HR` role did not exist** in the system. The configured approval flow's
   `HR_REVIEW` stage requires role `HR`, but the only roles present were
   `ACCOUNTS, ADMIN, DRIVER, EMPLOYEE, OPERATION_MANAGER, SUPER_ADMIN`. So after a
   sheet was submitted it got stuck at `HR_REVIEW` — no real user could act on it
   (only `SUPER_ADMIN`, which bypasses stage checks).
2. **Authorization is by *active role*, not by "has the role".** Both the platform
   `PermissionsGuard` and the payment-sheet stage check resolve against the single
   `X-Active-Role`, not the user's full role set. A multi-role user sending the
   wrong active role is correctly denied.

### Fixes applied
- **Migration `1860000000007-seed-hr-role.ts`** — seeds the `HR` role
  (`ON CONFLICT (name) DO NOTHING`) and grants it
  `financials.payment-sheets.{review, view, download}`. Idempotent; safe for prod.

---

## 2. Test setup

Real DB users (password `Admin@123`), roles assigned via `user_roles`:

| User (email) | Roles | Used as |
|---|---|---|
| abhidhakad1@yopmail.com | EMPLOYEE, OPERATION_MANAGER | Initiator (single role) |
| aryankushwaha067@yopmail.com | EMPLOYEE, HR | HR reviewer (single role) |
| akumar141141@yopmail.com | EMPLOYEE, ADMIN | Admin reviewer (single role) |
| anshikaagarwal2719@yopmail.com | EMPLOYEE, ACCOUNTS | Accountant / processor (single role) |
| anujp7074@yopmail.com | EMPLOYEE, OPERATION_MANAGER, HR, ADMIN, ACCOUNTS | **Multi-role** user |

Beneficiary used for line items: an employee with pending expense (`EXPENSE` source).
Active approval flow (DB config `payments.approval_flow`):

```
INITIATION (OPERATION_MANAGER)  →  HR_REVIEW (HR)  →  ADMIN_REVIEW (ADMIN)  →  PROCESSING (ACCOUNTS)
```

Required header on every call: `X-Active-Role` set to the role being exercised
(plus `Authorization`, `X-Correlation-Id` [UUID], `X-Source-Type`, `X-Client-Type`).

---

## 3. Results

### 3.1 Single-role handoff (incl. HR free-edit + Admin decrease) — ✅ PASS

| # | Step | Actor (active role) | HTTP | Outcome |
|---|---|---|---|---|
| 1 | Create sheet (item ₹100) | OPERATION_MANAGER | 201 | `DRAFT` |
| 2 | Submit | OPERATION_MANAGER | 201 | → `IN_REVIEW` / `HR_REVIEW` |
| 3 | Edit amount 100 → 90 (free) | HR | 200 | item amount updated |
| 4 | Forward | HR | 201 | → `ADMIN_REVIEW` |
| 5 | Decrease 90 → 80 (reason) | ADMIN | 200 | item amount updated |
| 6 | Forward | ADMIN | 201 | → `PROCESSING` |
| 7 | Pay item | ACCOUNTS | 201 | item PAID |
| 8 | Final state | — | 200 | **`COMPLETED`, item PAID @ ₹80.00** |

### 3.2 Multi-role user (one login, switch `X-Active-Role` per stage) — ✅ PASS

| # | Step | Active role sent | HTTP | Outcome |
|---|---|---|---|---|
| 1 | Create | OPERATION_MANAGER | 201 | `DRAFT` |
| 2 | Submit | OPERATION_MANAGER | 201 | → `HR_REVIEW` |
| 3 | Forward | HR | 201 | → `ADMIN_REVIEW` |
| 4 | Forward | ADMIN | 201 | → `PROCESSING` |
| 5 | Pay | ACCOUNTS | 201 | item PAID |
| 6 | Final state | — | 200 | **`COMPLETED`, item PAID @ ₹100.00** |

### 3.3 Return path (HR → initiator → re-submit) — ✅ PASS

| # | Step | Actor | HTTP | Outcome |
|---|---|---|---|---|
| 1 | Create + Submit | OPERATION_MANAGER | 201 | → `HR_REVIEW` |
| 2 | Return (reason) | HR | 201 | → `RETURNED` / `INITIATION` |
| 3 | Re-submit | OPERATION_MANAGER | 201 | → `IN_REVIEW` / `HR_REVIEW` |

### 3.4 Negative cases (authorization correctness) — ✅ PASS (correctly rejected)

| Scenario | Active role sent | Expected | Result |
|---|---|---|---|
| Forward at `HR_REVIEW` when `HR` role absent (pre-fix) | ADMIN | reject | `403 "not authorized at this stage"` |
| Act as a role the user doesn't have | HR (user lacks it) | reject | `403 "The requested role is not assigned to this user"` |
| Multi-role user forwards at `ADMIN_REVIEW` with wrong active role | ACCOUNTS | reject | `403 "not authorized at this stage"` |
| Multi-role user pays with wrong active role | ADMIN | reject | `403 "Missing permission: financials.payment-sheets.process"` |
| Pay an EXPENSE item without `category` | ACCOUNTS | reject | `400 "category is required to pay an expense item"` |

---

## 4. Conclusions

- ✅ With the `HR` role seeded, the full chain
  `OPERATION_MANAGER → HR → ADMIN → ACCOUNTS` works end-to-end for **both**
  single-role and multi-role users, including HR free-edit, Admin decrease,
  pay/settlement, and the return-to-initiator path.
- ✅ Authorization behaves correctly: actions are allowed only when the caller's
  **active role** owns the current stage (and, for processing, holds the
  `…payment-sheets.process` permission).
- The earlier FE errors were caused by the missing `HR` role + sending an active
  role that didn't match the stage — not by a defect in the payment-sheet logic.

## 5. Action items

| For | Item |
|---|---|
| Frontend | Send `X-Active-Role` = the role that owns the current stage for every action; for multi-role users, switch active role per stage. |
| Frontend | Re-login / refresh token after any role change — `roles[]` is baked into the JWT at login; a stale token yields `403 INVALID_ACTIVE_ROLE`. |
| Backend / DevOps | Run migration `1860000000007` on prod. Ensure prod has at least one real user assigned to each role in the chain (`OPERATION_MANAGER`, `HR`, `ADMIN`, `ACCOUNTS`). |
| Product | The approval chain is DB-configurable (`payments.approval_flow`) — keep it referencing only roles that exist. |

---

## 6. Notes / test data created on dev DB

- Role assignments added to 5 employee accounts (see §2) — left in place for further QA.
- Several test payment sheets created (statuses `COMPLETED`, `RETURNED`, `IN_REVIEW`).
- The `payments.approval_flow` config was temporarily toggled during testing and
  **restored** to the original (`…→ HR_REVIEW → …`).
