/**
 * Shapes returned by `/dashboard/me/*`.
 *
 * Numbers only, by request — no trend or distribution payloads. Where the admin dashboard shows a
 * company-wide count, the same field here is the caller's own.
 */

export interface MyAttendanceToday {
  /** Null when nothing has been recorded for today yet. */
  status: string | null;
  approvalStatus: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  attendanceType: string | null;
  /** Resolved from the allocation for today, the same way the attendance list resolves it. */
  site: { id: string; name: string } | null;
}

export interface MyAttendanceCounts {
  /**
   * Days that actually have a record — the honest denominator.
   *
   * Not a working-day figure: nothing in the system computes one yet, and the admin dashboard's
   * `totalWorkingDays` is a hard-coded 22 awaiting that work. A number that is wrong on one screen
   * should not be made wrong on two.
   */
  daysRecorded: number;
  worked: number;
  present: number;
  absent: number;
  onLeave: number;
  halfDay: number;
  holiday: number;
  approvalPending: number;
}

export interface MyAttendanceData {
  today: MyAttendanceToday;
  currentMonth: MyAttendanceCounts;
  lastMonth: MyAttendanceCounts;
}

export interface MyLeaveBalance {
  leaveCategory: string;
  totalAllocated: number;
  consumed: number;
  carriedForward: number;
  adjusted: number;
  balance: number;
}

export interface MyLeaveData {
  financialYear: string;
  balances: MyLeaveBalance[];
  totalBalance: number;
  pendingCount: number;
  upcomingApprovedCount: number;
  upcomingApprovedDays: number;
  nextLeaveFrom: string | null;
}

export interface MyExpenseData {
  /** What the company still owes me — same arithmetic as the pending-settlement screen. */
  settlement: { approved: number; settled: number; pending: number };
  currentMonth: {
    claims: number;
    total: number;
    pendingCount: number;
    pendingAmount: number;
    approvedCount: number;
    approvedAmount: number;
    rejectedCount: number;
    rejectedAmount: number;
  };
  byCategory: { category: string; count: number; amount: number }[];
  /** Drivers only; null for everyone else. */
  foodAllowance: {
    keptDays: number;
    keptAmount: number;
    redirectedDays: number;
    redirectedAmount: number;
    pairedDays: number;
  } | null;
}

export interface MyProjectData {
  current: {
    id: string;
    name: string;
    fullAddress: string | null;
    city: string | null;
    state: string | null;
    managerName: string | null;
    status: string | null;
    since: string;
    until: string | null;
    role: string | null;
    dailyAllowance: number | null;
  } | null;
  history: {
    id: string;
    name: string;
    city: string | null;
    from: string;
    to: string | null;
    role: string | null;
  }[];
}

export interface MyAsset {
  id: string;
  assetId: string;
  name: string | null;
  model: string | null;
  category: string | null;
  assetType: string | null;
  status: string | null;
  calibrationEndDate: string | null;
  warrantyEndDate: string | null;
  /** Negative once it has passed. Null when no date is recorded. */
  calibrationDaysLeft: number | null;
  warrantyDaysLeft: number | null;
}

export interface PendingHandover {
  id: string;
  label: string;
  offeredAt: string;
  offeredBy: string | null;
  /**
   * Hours left before the auto-penalty accepts it on the holder's behalf, from the same config
   * row the penalty cron reads. Null when the penalty is switched off.
   */
  hoursLeft: number | null;
}

/** A handover I have sent that the other person has not acted on yet. */
export interface OutgoingHandover {
  id: string;
  label: string;
  offeredAt: string;
  /** Who it is sitting with. */
  waitingOn: string | null;
}

export interface MyAssetsData {
  assets: MyAsset[];
  /** Waiting on me to accept. */
  pendingHandovers: PendingHandover[];
  /** Sent by me, waiting on someone else. */
  outgoingHandovers: OutgoingHandover[];
}

export interface MyVehicleData {
  isDriver: boolean;
  vehicle: {
    id: string;
    registrationNo: string;
    brand: string | null;
    model: string | null;
    fuelType: string | null;
    status: string | null;
    insuranceEndDate: string | null;
    pucEndDate: string | null;
    fitnessEndDate: string | null;
    insuranceDaysLeft: number | null;
    pucDaysLeft: number | null;
    fitnessDaysLeft: number | null;
    lastServiceKm: number | null;
    lastServiceDate: string | null;
    /** The highest reading recorded anywhere — fuel entries, services or trip logs. */
    currentOdometerKm: number | null;
  } | null;
  pendingHandovers: PendingHandover[];
  outgoingHandovers: OutgoingHandover[];
}

export interface MyFuelData {
  isDriver: boolean;
  currentMonth: {
    entries: number;
    amount: number;
    liters: number;
    pendingCount: number;
    pendingAmount: number;
    approvedCount: number;
    rejectedCount: number;
    petroCardCount: number;
    petroCardAmount: number;
    ownPaidAmount: number;
  };
}

export interface MyAlert {
  /** `handover-asset`, `handover-vehicle`, `attendance-approval`, `leave-low`, `document-expiry`. */
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  /** Hours or days, depending on the alert; null when nothing is counting down. */
  countdown: number | null;
}

export interface MyAlertsData {
  alerts: MyAlert[];
  counts: { critical: number; warning: number; info: number; total: number };
}
