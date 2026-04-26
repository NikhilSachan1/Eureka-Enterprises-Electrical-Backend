# Notification Map - Email & WhatsApp

Complete map of all scenarios where the system sends Email and/or WhatsApp notifications.

---

## Attendance

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Employee checks in | Self | Employee | - | Yes |
| 2 | Employee checks out | Self | Employee | - | Yes |
| 3 | Admin approves attendance | Manual (Admin) | Employee | Yes | Yes |
| 4 | Admin rejects attendance | Manual (Admin) | Employee | Yes | Yes |
| 5 | Admin regularizes attendance | Manual (Admin) | Employee | Yes | Yes |
| 6 | Admin force-creates attendance | Manual (Admin) | Employee | - | Yes |
| 7 | Admin marks absent | Manual (Admin) | Employee | - | Yes |
| 8 | Food expense credited | System (on attendance approval) | Employee or Assigned Engineer | - | Yes |
| 9 | Attendance approval reminder (25th-EOM) | Cron | HR/Admin | Yes | - |

**Food expense recipient logic:**
- Non-driver employee: food credit goes to the employee themselves
- Driver with assigned engineer: food credit goes to the assigned engineer (notification includes "On behalf of: [driver name]")
- Driver without assigned engineer: food credit goes to the driver

---

## Leave Applications

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Employee applies for leave | Self | Employee | - | Yes |
| 2 | Admin force-applies leave | Manual (Admin) | Employee | - | Yes |
| 3 | Admin approves leave | Manual (Admin) | Employee | Yes | Yes |
| 4 | Admin rejects leave | Manual (Admin) | Employee | Yes | Yes |
| 5 | Leave cancelled | Manual (Admin/Employee) | Employee | - | Yes |
| 6 | Leave auto-approved (1st of month) | Cron | - | - | - |

---

## Leave Balances

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Monthly leave accrual credited | Cron (1st of month, 12:30 AM) | Employee | - | Yes |
| 2 | FY leave config reminder (Mar 15-31) | Cron | HR/Admin | Yes | - |
| 3 | Leave approval reminder (25th-EOM) | Cron | HR/Admin | Yes | - |

---

## Expenses

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Employee submits expense | Self | Employee | - | Yes |
| 2 | Admin force-creates expense | Manual (Admin) | Employee | - | Yes |
| 3 | Admin approves expense | Manual (Admin) | Employee | Yes | Yes |
| 4 | Admin rejects expense | Manual (Admin) | Employee | Yes | Yes |
| 5 | Pending expense reminder | Cron | HR/Finance | Yes | - |

---

## Fuel Expenses

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Employee submits fuel expense | Self | Employee | - | Yes |
| 2 | Admin force-creates fuel expense | Manual (Admin) | Employee | - | Yes |
| 3 | Admin approves fuel expense | Manual (Admin) | Employee | Yes | Yes |
| 4 | Admin rejects fuel expense | Manual (Admin) | Employee | Yes | Yes |
| 5 | Fuel expense reimbursed | Manual (Admin) | Employee | - | Yes |

---

## Assets

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Asset handover initiated | Manual (Admin) | Recipient Employee | - | Yes |
| 2 | Asset handover accepted | Manual (Employee) | Admin/Initiator | - | Yes |
| 3 | Asset handover rejected | Manual (Employee) | Admin/Initiator | - | Yes |
| 4 | Asset handover cancelled | Manual (Admin) | Employee | - | Yes |
| 5 | Asset deallocated | Manual (Admin) | Employee | - | Yes |
| 6 | Asset calibration expiry alert | Cron (daily) | Asset Managers + Assigned User | Yes | - |
| 7 | Asset warranty expiry alert | Cron (daily) | Asset Managers + Assigned User | Yes | - |

---

## Vehicles

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Vehicle handover initiated | Manual (Admin) | Recipient Employee | - | Yes |
| 2 | Vehicle handover accepted | Manual (Employee) | Admin/Initiator | - | Yes |
| 3 | Vehicle handover rejected | Manual (Employee) | Admin/Initiator | - | Yes |
| 4 | Vehicle handover cancelled | Manual (Admin) | Employee | - | Yes |
| 5 | Vehicle deallocated | Manual (Admin) | Employee | - | Yes |
| 6 | Vehicle document expiry alert | Cron (daily) | Fleet Managers + Assigned User | Yes | - |
| 7 | Vehicle service due alert | Cron (daily) | Fleet Managers + Assigned User | Yes | - |

---

## Cards

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Card expiry alert | Cron (daily) | Finance/Admin | Yes | - |

---

## Users & Auth

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Welcome new employee | Admin creates user | Employee | Yes | Yes |
| 2 | Password reset link | Self (forget password) | User | Yes | Yes |

---

## Celebrations

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Birthday wish | Cron (daily) | Employee | Yes | - |
| 2 | Work anniversary wish | Cron (daily) | Employee | Yes | - |

---

## Payroll & FnF

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Payslip issued | Monthly payroll | Employee | Yes (PDF attached) | - |
| 2 | FnF documents sent | Employee separation | Employee | Yes (PDF attached) | - |

---

## System

| # | Scenario | Trigger | Recipient | Email | WhatsApp |
|---|----------|---------|-----------|-------|----------|
| 1 | Cron job failure alert | Cron execution fails | System Admins | Yes | - |

---

## Summary

| Channel | Count |
|---------|-------|
| Email only | ~18 scenarios |
| WhatsApp only | ~11 scenarios |
| Email + WhatsApp | ~8 scenarios |
| **Total** | **~37 scenarios** |

| Trigger Type | Count |
|--------------|-------|
| Self (Employee) | ~10 |
| Manual (Admin) | ~16 |
| Cron/System | ~11 |

### WhatsApp Opt-in
All WhatsApp notifications respect the `whatsappOptIn` flag on the user. If the user hasn't opted in, the WhatsApp notification is silently skipped.

### Communication Logs
All notifications are logged in the `communication_logs` table for audit and tracking.
