# WhatsApp Templates — Ready for Twilio/Meta Submission

All 38 templates converted from `whatsapp.constants.ts` into WhatsApp's **numbered `{{1}}` variable** format.

## How to use this doc
1. In Twilio Console → **Messaging → Content Template Builder → Create new**.
2. For each template below:
   - **Template name**: use the exact `name` (lowercase_snake_case) — Meta requires this format.
   - **Category**: as noted (`UTILITY` for notifications, `AUTHENTICATION` for password reset).
   - **Language**: English (`en` or `en_US`).
   - **Body**: paste the body text exactly.
   - **Sample values**: paste the samples so Meta can review.
3. Submit → wait for Meta approval (minutes to a few hours).
4. Copy the resulting **Content SID (`HX...`)** into the matching `contentSid: ''` field in `whatsapp.constants.ts`.

## ⚠️ Rules baked into these templates
- **No empty variables allowed.** Optional fields (remarks, notes, reason, total hours, amounts) are now always-present variables. The **code must send a fallback** (e.g. `—`, `N/A`, or `0`) when the real value is empty — otherwise Meta rejects the send at runtime. Each affected template is marked **⚠️ fallback required**.
- Variables are numbered sequentially with no gaps, as Meta requires.
- `*bold*` is preserved (WhatsApp supports it inside templates).

---

## ATTENDANCE

### 1. attendance_approved — UTILITY  ⚠️ fallback required ({{4}})
```
✅ *Attendance Approved*

Hi *{{1}}*,

Your attendance for *{{2}}* has been approved by *{{3}}*.

Remarks: {{4}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=date, 3=approverName, 4=remarks (send "—" if none)
Sample: `Rahul Sharma | 15 Jul 2026 | Amit Verma | Approved on time`

### 2. attendance_rejected — UTILITY  ⚠️ fallback required ({{4}})
```
❌ *Attendance Rejected*

Hi *{{1}}*,

Your attendance for *{{2}}* has been rejected by *{{3}}*.

Reason: {{4}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=date, 3=approverName, 4=remarks (send "—" if none)
Sample: `Rahul Sharma | 15 Jul 2026 | Amit Verma | Location mismatch`

### 3. attendance_regularized — UTILITY  ⚠️ fallback required ({{6}})
```
🔄 *Attendance Regularized*

Hi *{{1}}*,

Your attendance for *{{2}}* has been regularized by *{{3}}*.

📊 *Status Change:* {{4}} → {{5}}

📝 *Notes:* {{6}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=date, 3=regularizedByName, 4=originalStatus, 5=newStatus, 6=notes (send "—" if none)
Sample: `Rahul Sharma | 15 Jul 2026 | Amit Verma | Absent | Present | Was on site visit`

### 4. attendance_submitted — UTILITY
```
🕐 *Check-In Recorded*

Hi *{{1}}*,

Your check-in for *{{2}}* has been recorded at *{{3}}*. Your attendance is pending approval.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=date, 3=checkInTime
Sample: `Rahul Sharma | 15 Jul 2026 | 09:12 AM`

### 5. attendance_checked_out — UTILITY  ⚠️ fallback required ({{4}})
```
🕔 *Check-Out Recorded*

Hi *{{1}}*,

Your check-out for *{{2}}* has been recorded at *{{3}}*.

⏱️ *Total Hours:* {{4}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=date, 3=checkOutTime, 4=totalHours (send "—" if none)
Sample: `Rahul Sharma | 15 Jul 2026 | 06:30 PM | 9h 18m`

### 6. attendance_force_created — UTILITY
```
📋 *Attendance Entry Added*

Hi *{{1}}*,

An attendance entry has been added for *{{2}}* with status *{{3}}* by *{{4}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=date, 3=status, 4=createdByName
Sample: `Rahul Sharma | 15 Jul 2026 | Present | Amit Verma`

### 7. attendance_absent_marked — UTILITY
```
⚠️ *Marked as Absent*

Hi *{{1}}*,

You have been marked *ABSENT* for *{{2}}* as no check-in was recorded.

If this is incorrect, please contact your manager and ask for regularization.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=date
Sample: `Rahul Sharma | 15 Jul 2026`

---

## EXPENSES

### 8. expense_submitted — UTILITY
```
🧾 *Expense Submitted*

Hi *{{1}}*,

Your expense of *{{2}}* for *{{3}}* has been submitted successfully and is pending approval.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=category
Sample: `Rahul Sharma | ₹1,250 | Travel`

### 9. expense_approved — UTILITY  ⚠️ fallback required ({{5}})
```
✅ *Expense Approved*

Hi *{{1}}*,

Your expense of *{{2}}* for *{{3}}* has been approved by *{{4}}*.

Remarks: {{5}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=category, 4=approverName, 5=remarks (send "—" if none)
Sample: `Rahul Sharma | ₹1,250 | Travel | Amit Verma | Approved`

### 10. expense_rejected — UTILITY  ⚠️ fallback required ({{5}})
```
❌ *Expense Rejected*

Hi *{{1}}*,

Your expense of *{{2}}* for *{{3}}* has been rejected by *{{4}}*.

Reason: {{5}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=category, 4=approverName, 5=remarks (send "—" if none)
Sample: `Rahul Sharma | ₹1,250 | Travel | Amit Verma | Missing bill`

### 11. expense_force_created — UTILITY
```
🧾 *Expense Entry Added*

Hi *{{1}}*,

An expense of *{{2}}* for *{{3}}* has been added for you by *{{4}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=category, 4=createdByName
Sample: `Rahul Sharma | ₹1,250 | Travel | Amit Verma`

---

## FUEL EXPENSES

### 12. fuel_expense_submitted — UTILITY
```
⛽ *Fuel Expense Submitted*

Hi *{{1}}*,

Your fuel expense of *{{2}}* for vehicle *{{3}}* has been submitted successfully and is pending approval.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=vehicleNumber
Sample: `Rahul Sharma | ₹2,000 | MH12AB1234`

### 13. fuel_expense_approved — UTILITY  ⚠️ fallback required ({{5}})
```
✅ *Fuel Expense Approved*

Hi *{{1}}*,

Your fuel expense of *{{2}}* for vehicle *{{3}}* has been approved by *{{4}}*.

Remarks: {{5}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=vehicleNumber, 4=approverName, 5=remarks (send "—" if none)
Sample: `Rahul Sharma | ₹2,000 | MH12AB1234 | Amit Verma | Approved`

### 14. fuel_expense_rejected — UTILITY  ⚠️ fallback required ({{5}})
```
❌ *Fuel Expense Rejected*

Hi *{{1}}*,

Your fuel expense of *{{2}}* for vehicle *{{3}}* has been rejected by *{{4}}*.

Reason: {{5}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=vehicleNumber, 4=approverName, 5=remarks (send "—" if none)
Sample: `Rahul Sharma | ₹2,000 | MH12AB1234 | Amit Verma | Duplicate entry`

### 15. fuel_expense_reimbursed — UTILITY
```
💰 *Fuel Expense Reimbursed*

Hi *{{1}}*,

Your fuel expense settlement of *{{2}}* has been processed by *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=processedBy
Sample: `Rahul Sharma | ₹2,000 | Finance Team`

### 16. fuel_expense_force_created — UTILITY
```
⛽ *Fuel Expense Entry Added*

Hi *{{1}}*,

A fuel expense of *{{2}}* for vehicle *{{3}}* has been added for you by *{{4}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=vehicleNumber, 4=createdByName
Sample: `Rahul Sharma | ₹2,000 | MH12AB1234 | Amit Verma`

---

## LEAVE APPLICATIONS

### 17. leave_approved — UTILITY  ⚠️ fallback required ({{7}})
```
✅ *Leave Approved*

Hi *{{1}}*,

Your *{{2}}* from *{{3}}* to *{{4}}* (*{{5}} days*) has been approved by *{{6}}*.

Remarks: {{7}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=leaveType, 3=fromDate, 4=toDate, 5=totalDays, 6=approverName, 7=remarks (send "—" if none)
Sample: `Rahul Sharma | Casual Leave | 20 Jul 2026 | 22 Jul 2026 | 3 | Amit Verma | Enjoy`

### 18. leave_rejected — UTILITY  ⚠️ fallback required ({{6}})
```
❌ *Leave Rejected*

Hi *{{1}}*,

Your *{{2}}* from *{{3}}* to *{{4}}* has been rejected by *{{5}}*.

Reason: {{6}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=leaveType, 3=fromDate, 4=toDate, 5=approverName, 6=remarks (send "—" if none)
Sample: `Rahul Sharma | Casual Leave | 20 Jul 2026 | 22 Jul 2026 | Amit Verma | Peak workload`

### 19. leave_submitted — UTILITY
```
📝 *Leave Application Submitted*

Hi *{{1}}*,

Your *{{2}}* from *{{3}}* to *{{4}}* (*{{5}} day(s)*) has been submitted and is pending approval.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=leaveType, 3=fromDate, 4=toDate, 5=totalDays
Sample: `Rahul Sharma | Casual Leave | 20 Jul 2026 | 22 Jul 2026 | 3`

### 20. leave_cancelled — UTILITY  ⚠️ fallback required ({{6}})
```
🚫 *Leave Cancelled*

Hi *{{1}}*,

Your *{{2}}* from *{{3}}* to *{{4}}* has been cancelled by *{{5}}*.

Reason: {{6}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=leaveType, 3=fromDate, 4=toDate, 5=cancelledByName, 6=remarks (send "—" if none)
Sample: `Rahul Sharma | Casual Leave | 20 Jul 2026 | 22 Jul 2026 | Rahul Sharma | Plans changed`

### 21. leave_force_applied — UTILITY  ⚠️ fallback required ({{7}})
```
📋 *Leave Applied on Your Behalf*

Hi *{{1}}*,

*{{2}}* from *{{3}}* to *{{4}}* (*{{5}} day(s)*) has been applied for you by *{{6}}*.

Reason: {{7}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=leaveType, 3=fromDate, 4=toDate, 5=totalDays, 6=appliedByName, 7=reason (send "—" if none)
Sample: `Rahul Sharma | Sick Leave | 20 Jul 2026 | 21 Jul 2026 | 2 | Amit Verma | Reported unwell`

---

## LEAVE BALANCES

### 22. leave_balance_credited — UTILITY
```
✅ *Leave Balance Credited*

Hi *{{1}}*,

*{{2}} day(s)* of *{{3}}* have been credited for *{{4}}*.

📊 *Total Balance:* {{5}} days

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=credited, 3=leaveCategory, 4=month, 5=total
Sample: `Rahul Sharma | 1.5 | Casual Leave | Jul 2026 | 12`

---

## USERS & AUTH

### 23. welcome_employee — UTILITY
```
🎉 *Welcome to Eureka HRMS!*

Hi *{{1}}*,

Your account has been created. Here are your login details:

📧 Email: *{{2}}*
🔑 Password: *{{3}}*
🆔 Employee ID: *{{4}}*

Please login at {{5}} and change your password.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=email, 3=tempPassword, 4=employeeId, 5=loginUrl
Sample: `Rahul Sharma | rahul@company.com | Temp@1234 | EMP0231 | https://app.eureka.com`

### 24. forget_password — UTILITY
```
🔒 *Password Reset Request*

Hi *{{1}}*,

A password reset was requested for your account. Click the link below to reset your password:

{{2}}

If you didn't request this, please ignore this message.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=resetLink
Sample: `Rahul Sharma | https://app.eureka.com/reset?token=abc123`
> Note: If Meta flags the URL variable, consider making the reset link a fixed domain with only the token as a variable, or use a Button component.

---

## ASSETS

### 25. asset_handover_initiated — UTILITY
```
📦 *Asset Handover Initiated*

Hi *{{1}}*,

*{{2}}* has initiated a handover for asset *{{3}}* to you.

Please accept or reject it from the portal.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=assetId
Sample: `Rahul Sharma | Amit Verma | AST-00123`

### 26. asset_handover_accepted — UTILITY
```
✅ *Asset Handover Accepted*

Hi *{{1}}*,

*{{2}}* has accepted the handover for asset *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=assetId
Sample: `Amit Verma | Rahul Sharma | AST-00123`

### 27. asset_handover_rejected — UTILITY
```
❌ *Asset Handover Rejected*

Hi *{{1}}*,

*{{2}}* has rejected the handover for asset *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=assetId
Sample: `Amit Verma | Rahul Sharma | AST-00123`

### 28. asset_handover_cancelled — UTILITY
```
🚫 *Asset Handover Cancelled*

Hi *{{1}}*,

*{{2}}* has cancelled the handover for asset *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=assetId
Sample: `Rahul Sharma | Amit Verma | AST-00123`

### 29. asset_deallocated — UTILITY
```
📤 *Asset Deallocated*

Hi *{{1}}*,

*{{2}}* has deallocated asset *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=assetId
Sample: `Rahul Sharma | Amit Verma | AST-00123`

### 30. asset_lost — UTILITY  ⚠️ fallback required ({{7}})
```
🚨 *Asset Marked as Lost*

Hi *{{1}}*,

The asset *{{2}}* (ID: {{3}}) previously assigned to you has been marked as lost by *{{4}}*.

📝 *Reason:* {{5}}
📅 *Last seen:* {{6}}
💰 *Recovery:* {{7}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=assetName, 3=assetId, 4=actorName, 5=reason, 6=lastSeenDate, 7=recoveryAmount
> For {{7}}, send a full phrase, e.g. `₹5,000 added to your account as a debit` or `No recovery amount` when none.
Sample: `Rahul Sharma | Dell Laptop | AST-00123 | Amit Verma | Not returned | 10 Jul 2026 | ₹5,000 added to your account as a debit`

### 31. asset_recovered — UTILITY  ⚠️ fallback required ({{5}}, {{6}})
```
✅ *Asset Recovered*

Hi *{{1}}*,

Good news! The previously lost asset *{{2}}* (ID: {{3}}) has been recovered by *{{4}}*.

📝 *Notes:* {{5}}
💰 *Refund:* {{6}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=assetName, 3=assetId, 4=actorName, 5=notes (send "—" if none), 6=refundedAmount
> For {{6}}, send e.g. `₹5,000 credited back to your account` or `No refund` when none.
Sample: `Rahul Sharma | Dell Laptop | AST-00123 | Amit Verma | Found in store room | ₹5,000 credited back to your account`

---

## VEHICLES

### 32. vehicle_handover_initiated — UTILITY
```
🚗 *Vehicle Handover Initiated*

Hi *{{1}}*,

*{{2}}* has initiated a handover for vehicle *{{3}}* to you.

Please accept or reject it from the portal.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=vehicleNumber
Sample: `Rahul Sharma | Amit Verma | MH12AB1234`

### 33. vehicle_handover_accepted — UTILITY
```
✅ *Vehicle Handover Accepted*

Hi *{{1}}*,

*{{2}}* has accepted the handover for vehicle *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=vehicleNumber
Sample: `Amit Verma | Rahul Sharma | MH12AB1234`

### 34. vehicle_handover_rejected — UTILITY
```
❌ *Vehicle Handover Rejected*

Hi *{{1}}*,

*{{2}}* has rejected the handover for vehicle *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=vehicleNumber
Sample: `Amit Verma | Rahul Sharma | MH12AB1234`

### 35. vehicle_handover_cancelled — UTILITY
```
🚫 *Vehicle Handover Cancelled*

Hi *{{1}}*,

*{{2}}* has cancelled the handover for vehicle *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=vehicleNumber
Sample: `Rahul Sharma | Amit Verma | MH12AB1234`

### 36. vehicle_deallocated — UTILITY
```
📤 *Vehicle Deallocated*

Hi *{{1}}*,

*{{2}}* has deallocated vehicle *{{3}}*.

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=actorName, 3=vehicleNumber
Sample: `Rahul Sharma | Amit Verma | MH12AB1234`

---

## FOOD ALLOWANCE

### 37. food_expense_credited — UTILITY  ⚠️ fallback required ({{4}})
```
🍽️ *Food Allowance Credited*

Hi *{{1}}*,

Food allowance of *₹{{2}}* has been credited for *{{3}}*.

👤 *On behalf of:* {{4}}

- *Eureka HRMS*
```
Vars: 1=employeeName, 2=amount, 3=date, 4=creditedFor (send "—" if none)
Sample: `Rahul Sharma | 150 | 15 Jul 2026 | Driver Suresh`

### 38. driver_food_credited_to_engineer — UTILITY
```
🍽️ *Food Allowance Update*

Hi *{{1}}*,

Your food allowance of *₹{{2}}* for *{{3}}* has been credited to your assigned engineer *{{4}}*.

ℹ️ Net effect to you: *₹0* — shared for your information.

- *Eureka HRMS*
```
Vars: 1=driverName, 2=amount, 3=date, 4=engineerName
Sample: `Suresh Kumar | 150 | 15 Jul 2026 | Rahul Sharma`

---

## Category cheat-sheet
- All 38 above are **UTILITY** (transactional, tied to an existing user relationship). This is correct — they are the cheapest tier and approve fastest.
- If you ever add OTP login, that specific template would be **AUTHENTICATION**.

## After approval — remember
1. Paste each `HX...` Content SID into the matching `contentSid` field in `whatsapp.constants.ts`.
2. The code needs a small change to map named `templateData` → numbered `contentVariables` (`{"1": ..., "2": ...}`) for production. Track this separately.
3. Set the optional-field fallbacks (marked ⚠️) in the sender methods so no variable is ever empty.
