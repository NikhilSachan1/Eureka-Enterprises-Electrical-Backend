# Notification requirements v7 — build spec

Source: `eureka_notification_requirements_v7.html` (product, working draft) plus the answers given on
2026-10-27. This spec turns that document into what the backend sends, to whom, on which channel,
and where in the code each event hooks in.

Builds on the bell + push system in [in-app-notifications-spec.md](in-app-notifications-spec.md).

---

## 1. Decisions (2026-10-27)

| # | Question | Decision |
|---|---|---|
| D1 | Channels for new events | **Bell + Push + Email.** No new WhatsApp — templates are not being set up now. Existing WhatsApp messages stay as they are. |
| D2 | Approval documents (PO, JMC, Report, Invoice, Advance, Payment request) | **Added / edited → the people who can approve. Approved / rejected → the creator.** |
| D3 | "No notification" events in the doc | Stop them: own check-in / check-out, add expense, add fuel expense. |
| D4 | Events we send that the doc doesn't list | **Remove:** leave applied, leave cancelled, F&F documents (bell). **Keep:** marked absent, food allowance, handover penalty, asset lost / recovered, expiry digests, admin reminders, payslip, birthday / anniversary. |
| D5 | Wallet | Every active employee. |
| D6 | Payment sheet returned | To the creator (what happens today). |
| D7 | Profile edited | Notify on every edit, all channels in D1. |
| D8 | Site scoping of permission-based recipients | None. Everyone holding the permission, as the permission system has it today. |
| D9 | Missing section 9 in the doc | Nothing missing. |

### Rules that apply to every event

- **Permission-based recipients** = every active user who holds the permission (section 3). Never a
  hard-coded admin.
- **The person who did the action is never notified about it.** An admin who adds a PO and can also
  approve POs does not get "PO added".
- **One record per person per event.** Bell and push are the same record (as today). The email
  carries the same title and message.
- **A user who appears twice** (creator and also an approver) gets one notification, not two.

---

## 2. Channel: email for every event

Today only some events send email, each with its own template. For the new events:

- **One generic template** `notification.hbs`: company header, the bell **title** as heading, the
  bell **message** as body, and an "Open in portal" button to `FE_BASE_URL + route`.
- `NotificationService.notify()` gets an `email: true` option. When set, after the bell rows are
  written it sends that generic email to each recipient, fire-and-forget, logged in
  `communication_logs` like every other email.
- Events that already have their own email template keep it (approve / reject of attendance, leave,
  expense, fuel; asset lost / recovered; payment sheet stages; welcome). They do **not** also get the
  generic email.

Existing events that the doc wants on email but have none today get `email: true`: force
attendance, force expense, force fuel, force leave, leave credited, asset & vehicle handover
(5 actions each).

---

## 3. Permission-based recipient lookup

New `RecipientResolver.usersWithPermission(permissionName)` → user ids.

A user holds a permission when **any** of their roles grants it (`user_roles` → `role_permissions`,
active rows) **or** they have an explicit grant in `user_permissions` — **minus** an explicit deny
in `user_permissions`. Same rules as `PermissionsGuard`, but across all of the user's roles, not
just the active one (a notification isn't tied to a session). Active, non-deleted users only.

One SQL query; no caching (permissions change rarely, events are low volume).

| Doc says | Permission used |
|---|---|
| PO approvers / management | `financials.purchase-orders.approve` |
| PO unlock handlers | `financials.purchase-orders.unlock` |
| JMC | `financials.jmcs.approve` / `financials.jmcs.unlock` |
| Report | `financials.site-reports.approve` / `financials.site-reports.unlock` |
| Invoice | `financials.invoices.approve` / `financials.invoices.unlock` |
| Advance payment reviewers | `financials.advance-payments.approve` |
| Payment request managers | `financials.payment-requests.approve` |

"Management permission" for edit / delete is read as the **approve** permission — those are the
people who review the document. (Assumption; the doc doesn't name one.)

---

## 4. Event list

Legend: ✅ exists, no change · 🔧 exists, change needed · 🆕 new · ❌ remove

### 4.1 Employee

| Event | Recipient | Status | Work |
|---|---|---|---|
| Add employee | New employee | ✅ | Welcome email + WhatsApp (if opted in) already sent at creation. No bell / push (doc: they can't log in yet). |
| Profile edited | That employee | 🆕 | Hook `PATCH /users/:id`. Bell + push + email: "Your profile has been updated successfully." Skip when the employee edits their own profile (actor rule). |
| Email changed | That employee | 🆕 | Same hook, when `email` changes. Bell + push, and email **to the new address only**: "Your email address has been updated successfully." Replaces the profile-edited notice for that save (one, not two). |

### 4.2 Attendance

| Event | Recipient | Status | Work |
|---|---|---|---|
| Own check-in / check-out | — | ❌ | Remove bell, push and WhatsApp from the `action` flow. |
| Force attendance | Employee | 🔧 | Add email. |
| Approve / reject | Employee | ✅ | Bell, push, WhatsApp, email already. |
| Delete attendance | Employee | 🆕 | Hook `DELETE /attendance/:id`. "Your attendance for {date} was deleted by {name}". |
| Regularize | Employee | ✅ | Already all channels. |
| Marked absent, food allowance | Employee | ✅ | Kept (D4). |

### 4.3 Expense & fuel

| Event | Recipient | Status | Work |
|---|---|---|---|
| Add expense / add fuel | — | ❌ | Remove bell, push and WhatsApp (`expenseSubmitted`, `fuelSubmitted`). |
| Approve / reject | Owner | ✅ | |
| Force | Owner | 🔧 | Add email. |
| Handover penalty | Employee | ✅ | Kept (D4). |

### 4.4 Leave

| Event | Recipient | Status | Work |
|---|---|---|---|
| Leave applied | — | ❌ | Remove the employee's bell / push / WhatsApp confirmation. |
| Leave cancelled | — | ❌ | Remove. |
| Approve / reject | Employee | ✅ | |
| Force leave | Employee | 🔧 | Add email. |
| Monthly credit | Employee | 🔧 | Add email. Message: "Your monthly leave balance has been credited successfully." (current message adds the numbers — keep the numbers). |

### 4.5 Asset & vehicle

| Event | Recipient | Status | Work |
|---|---|---|---|
| Handover initiated / cancelled | Receiver | 🔧 | Add email. |
| Handover accepted / rejected | Initiator | 🔧 | Add email. |
| Deallocated | Previous holder | 🔧 | Add email. |
| Lost / recovered, expiry digests | | ✅ | Kept (D4). |

### 4.6 Payment sheet

| Event | Recipient | Status | Work |
|---|---|---|---|
| Forward to HR / Admin / Accountant | Everyone with that role | ✅ | Bell + email today, recipients by role. Push comes with the bell. |
| Returned | Creator | ✅ | D6. |
| Expense line paid | The employee | 🆕 | Hook `payItem` → after `createCreditExpense`. "₹{amount} paid against your expenses — payment sheet {no}". |
| Fuel line paid | The employee | 🔧 | `fuelReimbursed` bell exists; add email. |
| Vendor line paid | Vendor | — | Email only per doc. Today vendors get the payment-advice email, sent by hand from Payment Advices. **Open item O1.** |
| Expense line rejected | The employee | 🆕 | Hook `rejectItem` (EXPENSE). "{name} rejected your expense payment. Reason: {reason}" |
| Fuel line rejected | The employee | 🆕 | Hook `rejectItem` (FUEL_EXPENSE). "{name} rejected your fuel expense payment. Reason: {reason}" |
| Wallet / vendor line rejected | — | — | Doc: no notification. |

### 4.7 Wallet

| Event | Recipient | Status | Work |
|---|---|---|---|
| Wallet recharged | All active employees (D5) | 🆕 | Fire when the recharge actually **credits** the wallet — the wallet line is paid in the payment sheet. "Your wallet balance has been recharged successfully." Not on creating / editing / deleting a recharge request (the balance hasn't changed yet). **Assumption — see O2.** |

### 4.8 PO, JMC, Report, Invoice (same pattern, 8 events each = 32)

| Event | Recipient | Message (PO shown; others swap the name) |
|---|---|---|
| Added | `.approve` holders | "PO {no} added by {name} and waiting for approval" |
| Edited | `.approve` holders + creator | "PO {no} was edited by {name}" |
| Deleted | `.approve` holders + creator | "PO {no} was deleted by {name}" |
| Approved | Creator | "Your PO {no} was approved by {name}" |
| Rejected | Creator | "Your PO {no} was rejected by {name} — "{reason}"" |
| Unlock requested | `.unlock` holders | "A PO unlock request has been received and requires your attention" (doc wording) + "{no}, by {name}" |
| Unlock granted | Requester | "Your unlock request for PO {no} was granted by {name}" |
| Unlock rejected | Requester | "Your unlock request for PO {no} was rejected by {name}" |

Hooks (built 2026-10-27): in the four **controllers**, after the service call returns, through
`DocumentNotifierService` (`notifications/document-notifier.service.ts`). One table there holds each
document's label, table, number column, permissions, route and category; one switch holds the
recipient rules. Grant / reject unlock and delete take a `snapshot()` first, because the service
clears the requester (or hides the row). The services are untouched. Site reports are created
already approved, so their "added" message says "added", not "waiting for approval". Routes: `/purchase-orders/{id}`, `/jmcs/{id}`, `/site-reports/{id}`,
`/site-invoices/{id}` (FE to confirm).

The doc number, site name and party are fetched once per event for the message.

### 4.9 Advance payment (4)

| Event | Recipient |
|---|---|
| Added | `financials.advance-payments.approve` holders |
| Edited | same |
| Approved | Creator |
| Rejected | Creator |

### 4.10 Payment request (5)

| Event | Recipient |
|---|---|
| Added / edited / deleted | `financials.payment-requests.approve` holders |
| Approved / rejected | Creator |

### 4.11 Not in the doc, kept as they are (D4)

Marked absent · food allowance · handover penalty · asset lost / recovered · expiry digests · admin
pending reminders · payslip ready · birthday / work anniversary · FY leave-config reminder.

### 4.12 Removed (D3, D4)

`attendanceCheckedIn`, `attendanceCheckedOut`, `expenseSubmitted`, `fuelSubmitted`,
`leaveSubmitted`, `leaveCancelled`, `fnfDocumentsSent` — the call sites are removed, on every
channel (bell, push, WhatsApp). The F&F **documents email itself stays**; only its bell entry goes.
Old rows already in users' bells are left alone and age out after 90 days.

---

## 5. Implementation notes

- **Never block the action.** Every notification is fire-and-forget after the transaction commits.
  A failed email or push never fails an approve / pay / delete.
- **After commit, not inside.** Hooks run after the DB transaction returns, so a rolled-back action
  never notifies.
- New event builders go in `notification.events.ts`, like the existing ones; new categories in
  `notification.constants.ts`.
- No schema change. `notifications.category` and `referenceType` are free text.

---

## 6. Phases

| Phase | Scope | Size |
|---|---|---|
| **1** | Removals (4.12) · email channel + generic template (2) · email on existing events (4.2–4.5) · attendance delete · employee profile / email change | ~1.5 days |
| **2** | Recipient lookup (3) · PO, JMC, Report, Invoice (4.8) | ~2 days |
| **3** | Advance payment · Payment request · Payment sheet paid / rejected lines · Wallet | ~1.5 days |

Each phase is tested on dev before the next: one test per event checking recipients (including the
actor rule and de-duplication), title / message, bell row, push send, email send.

---

## 7. Open items — resolved 2026-10-27

| # | Item | Answer |
|---|---|---|
| O1 | Vendor payment email | **Yes, automatic.** Paying a vendor line in the payment sheet emails the vendor. |
| O2 | Wallet trigger | **When the wallet line is paid in the payment sheet.** |
| O3 | Wallet email to every employee | **Yes.** |
| O4 | "Management permission" for edit / delete | **The approve permission**, as in section 3. |
| O5 | Portal routes for the document types | **Assumed** for now (`/purchase-orders/{id}`, `/jmcs/{id}`, `/site-reports/{id}`, `/site-invoices/{id}`, `/advance-payments/{id}`, `/payment-requests/{id}`). FE can correct later; old bell rows keep the old route. |
