# Attendance Regularization - Comprehensive Documentation

## Overview

This document covers all attendance regularization scenarios, including food expense handling, leave balance management, and the various status transitions that can occur when an admin regularizes an employee's attendance.

---

## Table of Contents

1. [Status Types](#status-types)
2. [Regularization Matrix](#regularization-matrix)
3. [Detailed Scenarios](#detailed-scenarios)
4. [Food Expense Handling](#food-expense-handling)
5. [Leave Balance Handling](#leave-balance-handling)
6. [Force Attendance](#force-attendance)
7. [API Reference](#api-reference)
8. [Flow Diagrams](#flow-diagrams)

---

## Status Types

| Status | Code | Description |
|--------|------|-------------|
| Present | `present` | Employee was present and worked |
| Absent | `absent` | Employee was absent without leave |
| Leave | `leave` | Employee was on approved paid leave |
| Leave Without Pay | `leaveWithoutPay` | Employee was on unpaid leave |
| Holiday | `holiday` | Company holiday |
| Checked In | `checkedIn` | Employee checked in but not yet checked out |
| Approval Pending | `approvalPending` | Attendance pending manager approval |
| Half Day | `halfDay` | Employee worked half day |
| Not Checked In Yet | `notCheckedInYet` | No attendance record for the day |

---

## Regularization Matrix

### Legend
- ✅ = Allowed
- ❌ = Not Allowed
- 🍽️ = Food expense credited
- 🍽️❌ = Food expense reversed
- 📅+ = Leave credited back
- 📅- = Leave debited

| From ↓ / To → | PRESENT | ABSENT | LEAVE | HOLIDAY |
|---------------|---------|--------|-------|---------|
| **ABSENT** | ✅ 🍽️ | - | ✅ 📅- | ✅ |
| **APPROVAL_PENDING** | ✅ 🍽️ | ✅ | ✅ 📅- | ✅ |
| **CHECKED_IN** | ✅ 🍽️ | ✅ | ✅ 📅- | ✅ |
| **PRESENT** | - | ✅ 🍽️❌ | ✅ 📅- 🍽️❌ | ✅ 🍽️❌ |
| **LEAVE** | ✅ 📅+ 🍽️ | ✅ 📅+ | - | ✅ 📅+ |
| **HOLIDAY** | ✅ 🍽️ | ❌ | ❌ | - |

---

## Detailed Scenarios

### 1. Regularizing TO PRESENT

#### 1.1 ABSENT → PRESENT
```
Actions:
├── ✅ Mark attendance as PRESENT
├── 🍽️ Credit food expense (daily allowance)
└── 📝 Create new attendance record
```

#### 1.2 APPROVAL_PENDING → PRESENT
```
Actions:
├── ✅ Mark attendance as PRESENT
├── 🍽️ Credit food expense (daily allowance)
└── 📝 Create new attendance record
```

#### 1.3 CHECKED_IN → PRESENT
```
Actions:
├── ✅ Mark attendance as PRESENT
├── 🍽️ Credit food expense (daily allowance)
└── 📝 Create new attendance record with check-in/out times
```

#### 1.4 LEAVE → PRESENT
```
Actions:
├── 📅 Find leave application for the date
├── 📅+ Credit back 1 day to leave balance
├── ❌ Cancel leave application (if single-day)
├── 🍽️ Credit food expense (daily allowance)
└── 📝 Create new PRESENT attendance record
```

#### 1.5 HOLIDAY → PRESENT
```
Actions:
├── ✅ Mark attendance as PRESENT
├── 🍽️ Credit food expense (daily allowance)
├── 🎁 Bonus leave credited with payroll generation
└── 📝 Create new attendance record
```

---

### 2. Regularizing TO ABSENT

#### 2.1 PRESENT → ABSENT
```
Actions:
├── 🍽️❌ Reverse food expense (create negative entry)
├── ✅ Mark attendance as ABSENT
└── 📝 Create new attendance record
```

#### 2.2 APPROVAL_PENDING → ABSENT
```
Actions:
├── ✅ Mark attendance as ABSENT (no food to reverse)
└── 📝 Create new attendance record
```

#### 2.3 CHECKED_IN → ABSENT
```
Actions:
├── ✅ Mark attendance as ABSENT (no food to reverse)
└── 📝 Create new attendance record
```

#### 2.4 LEAVE → ABSENT
```
Actions:
├── 📅 Find leave application for the date
├── 📅+ Credit back 1 day to leave balance
├── ❌ Cancel leave application (if single-day)
├── ✅ Mark attendance as ABSENT
└── 📝 Create new attendance record
```

#### 2.5 HOLIDAY → ABSENT
```
❌ NOT ALLOWED
Reason: Holiday cannot be regularized as absent
```

---

### 3. Regularizing TO LEAVE

> **Note:** Requires `leaveCategory` parameter in the request

#### 3.1 PRESENT → LEAVE
```
Actions:
├── ✅ Validate leave balance exists
├── ✅ Check sufficient balance (≥ 1 day)
├── 📅- Debit 1 day from leave balance
├── 📝 Create forced leave application
├── 🍽️❌ Reverse food expense (was present)
├── ✅ Mark attendance as LEAVE
└── 📝 Create new attendance record
```

#### 3.2 ABSENT → LEAVE
```
Actions:
├── ✅ Validate leave balance exists
├── ✅ Check sufficient balance (≥ 1 day)
├── 📅- Debit 1 day from leave balance
├── 📝 Create forced leave application
├── ✅ Mark attendance as LEAVE
└── 📝 Create new attendance record
```

#### 3.3 APPROVAL_PENDING → LEAVE
```
Actions:
├── ✅ Validate leave balance exists
├── ✅ Check sufficient balance (≥ 1 day)
├── 📅- Debit 1 day from leave balance
├── 📝 Create forced leave application
├── ✅ Mark attendance as LEAVE
└── 📝 Create new attendance record
```

#### 3.4 CHECKED_IN → LEAVE
```
Actions:
├── ✅ Validate leave balance exists
├── ✅ Check sufficient balance (≥ 1 day)
├── 📅- Debit 1 day from leave balance
├── 📝 Create forced leave application
├── ✅ Mark attendance as LEAVE
└── 📝 Create new attendance record
```

#### 3.5 HOLIDAY → LEAVE
```
❌ NOT ALLOWED
Reason: Holiday cannot be regularized as leave
```

---

### 4. Regularizing TO HOLIDAY

#### 4.1 PRESENT → HOLIDAY
```
Actions:
├── 🍽️❌ Reverse food expense (was present)
├── ✅ Mark attendance as HOLIDAY
└── 📝 Create new attendance record
```

#### 4.2 ABSENT → HOLIDAY
```
Actions:
├── ✅ Mark attendance as HOLIDAY (nothing to reverse)
└── 📝 Create new attendance record
```

#### 4.3 APPROVAL_PENDING → HOLIDAY
```
Actions:
├── ✅ Mark attendance as HOLIDAY (nothing to reverse)
└── 📝 Create new attendance record
```

#### 4.4 CHECKED_IN → HOLIDAY
```
Actions:
├── ✅ Mark attendance as HOLIDAY (nothing to reverse)
└── 📝 Create new attendance record
```

#### 4.5 LEAVE → HOLIDAY
```
Actions:
├── 📅 Find leave application for the date
├── 📅+ Credit back 1 day to leave balance
├── ❌ Cancel leave application (if single-day)
├── ✅ Mark attendance as HOLIDAY
└── 📝 Create new attendance record
```

---

## Food Expense Handling

### Daily Food Allowance Calculation

```
Daily Food Allowance = Monthly Food Allowance / Days in Month

Example:
- Monthly Food Allowance: ₹2,200
- Days in January: 31
- Daily Allowance: ₹2,200 / 31 = ₹70.97
```

### Credit Scenarios

| Scenario | Action |
|----------|--------|
| Attendance approved | Credit food expense |
| Regularized to PRESENT | Credit food expense |
| Force attendance (PRESENT + APPROVED) | Credit food expense |

### Reversal Scenarios

| Scenario | Action |
|----------|--------|
| Approved → Rejected | Reverse food expense |
| PRESENT → ABSENT | Reverse food expense |
| PRESENT → LEAVE | Reverse food expense |
| PRESENT → HOLIDAY | Reverse food expense |

### Reference IDs

| Type | Format |
|------|--------|
| Credit | `ATT_FOOD_{userId}_{date}` |
| Reversal | `ATT_FOOD_REV_{userId}_{date}` |

---

## Leave Balance Handling

### Leave Credit (Balance Returned)

When regularizing **FROM LEAVE** to another status:

```
1. Find leave application for the date
2. Decrement consumed by 1: consumed = consumed - 1
3. If single-day leave: Cancel the leave application
4. If multi-day leave: Just credit back (can't cancel partial)
```

### Leave Debit (Balance Consumed)

When regularizing **TO LEAVE** (Force Leave):

```
1. Validate leaveCategory is provided
2. Check leave balance exists for category
3. Validate sufficient balance (≥ 1 day)
4. Increment consumed by 1: consumed = consumed + 1
5. Create forced leave application record
```

### Multi-day Leave Handling

When an employee has a multi-day leave (e.g., Jan 5-10) and only one day is regularized:

| Day | Original Status | After Regularization |
|-----|-----------------|---------------------|
| Jan 5 | LEAVE | LEAVE |
| Jan 6 | LEAVE | LEAVE |
| Jan 7 | LEAVE | **PRESENT** (regularized) |
| Jan 8 | LEAVE | LEAVE |
| Jan 9 | LEAVE | LEAVE |
| Jan 10 | LEAVE | LEAVE |

- ✅ 1 day credited back to leave balance
- ❌ Leave application NOT cancelled (other days still valid)
- 📝 Log entry created for audit

---

## Force Attendance

### During Shift
```
- Status: PENDING (requires approval)
- Food expense: NOT credited (will be credited on approval)
```

### After Shift (Same Day)
```
- Status: APPROVED
- Food expense: CREDITED immediately
- Requires: Check-in and check-out times
```

### Previous Day
```
- Status: APPROVED
- Food expense: CREDITED immediately
- Requires: Check-in and check-out times
```

---

## API Reference

### Regularize Attendance

```http
PUT /api/v1/attendance/:attendanceId/regularize
```

**Request Body:**

```json
{
  "userId": "uuid",
  "status": "present | absent | leave | holiday",
  "checkInTime": "HH:MM",      // Required when status is present
  "checkOutTime": "HH:MM",     // Required when status is present
  "leaveCategory": "string",   // Required when status is leave
  "notes": "string",           // Optional
  "attendanceType": "regularized",
  "entrySourceType": "web | mobile"
}
```

**Validation Rules:**

| Field | Condition | Required |
|-------|-----------|----------|
| checkInTime | status = present | ✅ |
| checkOutTime | status = present | ✅ |
| leaveCategory | status = leave | ✅ |

---

## Flow Diagrams

### Regularization Decision Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  REGULARIZATION REQUEST                      │
│                                                              │
│   From: [Current Status]  →  To: [New Status]               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     Was Previous PRESENT?     │
              └───────────────────────────────┘
                    │                 │
                   YES               NO
                    │                 │
                    ▼                 │
        ┌──────────────────┐          │
        │ Reverse Food     │          │
        │ Expense          │          │
        └──────────────────┘          │
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
              ┌───────────────────────────────┐
              │     Was Previous LEAVE?       │
              └───────────────────────────────┘
                    │                 │
                   YES               NO
                    │                 │
                    ▼                 │
        ┌──────────────────┐          │
        │ Credit Back      │          │
        │ Leave Balance    │          │
        └──────────────────┘          │
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
              ┌───────────────────────────────┐
              │     Is New Status PRESENT?    │
              └───────────────────────────────┘
                    │                 │
                   YES               NO
                    │                 │
                    ▼                 │
        ┌──────────────────┐          │
        │ Credit Food      │          │
        │ Expense          │          │
        └──────────────────┘          │
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
              ┌───────────────────────────────┐
              │     Is New Status LEAVE?      │
              └───────────────────────────────┘
                    │                 │
                   YES               NO
                    │                 │
                    ▼                 │
        ┌──────────────────┐          │
        │ Debit Leave      │          │
        │ Balance          │          │
        │ Create Leave App │          │
        └──────────────────┘          │
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
              ┌───────────────────────────────┐
              │    Update Attendance Record   │
              └───────────────────────────────┘
```

### Expense Summary Impact

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPENSE TRACKER                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Opening Balance                                             │
│       ↓                                                      │
│  + Food Credits (Attendance Approved/Present)                │
│  - Food Reversals (Attendance Rejected/Changed)              │
│       ↓                                                      │
│  = Closing Balance                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Constants Reference

### Food Expense Constants

```typescript
FOOD_EXPENSE_CONSTANTS = {
  CATEGORY: 'Food',
  REFERENCE_TYPE: 'ATTENDANCE_FOOD_ALLOWANCE',
  DESCRIPTION: 'Food allowance for attendance on {date}',
  REVERSAL_DESCRIPTION: 'Reversal: Food allowance for {date} (attendance rejected)',
  REFERENCE_ID: 'ATT_FOOD_{userId}_{date}',
  REVERSAL_REFERENCE_ID: 'ATT_FOOD_REV_{userId}_{date}',
}
```

### Leave Regularization Constants

```typescript
LEAVE_REGULARIZATION_CONSTANTS = {
  LEAVE_CANCELLED_REASON_PRESENT: 'Leave cancelled - Attendance regularized as present on {date}',
  LEAVE_CANCELLED_REASON_ABSENT: 'Leave cancelled - Attendance regularized as absent on {date}',
  LEAVE_CANCELLED_REASON_HOLIDAY: 'Leave cancelled - Date marked as holiday on {date}',
  REGULARIZATION_NOTES_PRESENT: 'Regularized from leave to present on {date}',
  REGULARIZATION_NOTES_ABSENT: 'Regularized from leave to absent on {date}',
  REGULARIZATION_NOTES_HOLIDAY: 'Regularized from leave to holiday on {date}',
  FORCE_LEAVE_NOTES: 'Regularized to leave on {date}',
  FORCE_LEAVE_REASON: 'Forced leave applied via attendance regularization on {date}',
}
```

---

## Error Messages

| Error | Cause |
|-------|-------|
| `Holiday is not allowed to be regularized as absent` | Trying to mark holiday as absent |
| `Holiday is not allowed to be regularized as leave` | Trying to mark holiday as leave |
| `Attendance is already regularized and status is {status}` | Trying to regularize to same status |
| `No leave balance found for category "{X}"` | Leave category doesn't exist |
| `Insufficient leave balance. Available: X days` | Not enough leave balance |
| `Leave category is required when status is leave` | Missing leaveCategory in request |
| `Check-in time is required when status is present` | Missing check-in time |
| `Check-out time is required when status is present` | Missing check-out time |

---

## Audit Trail

All regularization actions are logged with:

- User who performed the action
- Timestamp
- Previous status
- New status
- Notes/reason
- Food expense transactions (if any)
- Leave balance changes (if any)

---

*Last Updated: January 2026*

 