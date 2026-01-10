import { AlertSeverity, AlertType } from './constants/dashboard.constants';

// ==================== Chart Data Types ====================

export interface TrendChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface DistributionChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

// ==================== Overview Section ====================

export interface OverviewData {
  employees: {
    total: number;
    active: number;
    inactive: number;
    newThisMonth: number;
    exitingThisMonth: number;
    onProbation: number;
  };
  todayAttendance: {
    present: number;
    absent: number;
    onLeave: number;
    holiday: number;
    notCheckedInYet: number;
    approvalPending: number;
    checkedIn: number;
    checkedOut: number;
  };
  pendingApprovals: {
    leave: number;
    attendance: number;
    expense: number;
    total: number;
  };
  currentMonthPayroll: {
    draft: number;
    generated: number;
    approved: number;
    paid: number;
    cancelled: number;
    totalAmount: number;
  };
}

// ==================== Birthdays & Anniversaries ====================

export interface EmployeeCelebration {
  userId: string;
  name: string;
  email: string;
  department?: string;
  profilePicture?: string;
  date: string;
  daysUntil?: number;
}

export interface BirthdayData {
  today: EmployeeCelebration[];
  thisWeek: EmployeeCelebration[];
  thisMonth: EmployeeCelebration[];
  counts: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export interface AnniversaryEmployee extends EmployeeCelebration {
  yearsCompleted: number;
}

export interface AnniversaryData {
  today: AnniversaryEmployee[];
  thisWeek: AnniversaryEmployee[];
  thisMonth: AnniversaryEmployee[];
  counts: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

// ==================== Festivals ====================

export interface Holiday {
  date: string;
  name: string;
  description?: string;
  type?: string;
  daysUntil?: number;
}

export interface FestivalData {
  today: Holiday[];
  upcoming: Holiday[];
  thisMonth: Holiday[];
  counts: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

// ==================== Attendance ====================

export interface AttendanceData {
  today: {
    present: number;
    absent: number;
    onLeave: number;
    holiday: number;
    halfDay: number;
    notCheckedInYet: number;
    approvalPending: number;
    checkedIn: number;
    checkedOut: number;
  };
  currentMonth: {
    totalWorkingDays: number;
    avgPresentPercentage: number;
    avgAbsentPercentage: number;
    avgLeavePercentage: number;
  };
  trend: TrendChartData;
  distribution: DistributionChartData;
  lateArrivals: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

// ==================== Leave ====================

export interface PendingLeaveItem {
  id: string;
  userId: string;
  userName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string;
  appliedAt: string;
}

export interface LeaveData {
  pendingApprovals: {
    count: number;
    items: PendingLeaveItem[];
  };
  currentMonthSummary: {
    totalLeavesTaken: number;
    byType: Record<string, number>;
  };
  upcomingLeaves: {
    userId: string;
    userName: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    days: number;
  }[];
  balanceOverview: Record<
    string,
    {
      allocated: number;
      consumed: number;
      balance: number;
    }
  >;
  trend: TrendChartData;
  distribution: DistributionChartData;
}

// ==================== Payroll ====================

export interface PayrollStatusCount {
  draft: number;
  generated: number;
  approved: number;
  paid: number;
  cancelled: number;
}

export interface PayrollMonthData {
  month: number;
  year: number;
  status: PayrollStatusCount;
  totalGrossEarnings: number;
  totalDeductions: number;
  totalNetPayable: number;
  totalBonus: number;
}

export interface PayrollData {
  currentMonth: PayrollMonthData;
  previousMonth?: PayrollMonthData;
  trend: TrendChartData;
  deductionBreakdown: {
    employeePf: number;
    employerPf: number;
    tds: number;
    esic: number;
    professionalTax: number;
  };
}

// ==================== Expenses ====================

export interface ExpenseData {
  currentMonth: {
    totalExpenses: number;
    totalCredits: number;
    pendingClaims: number;
    approvedClaims: number;
    rejectedClaims: number;
  };
  pendingApprovals: {
    count: number;
    items: {
      id: string;
      userId: string;
      userName: string;
      category: string;
      amount: number;
      description?: string;
      claimedAt: string;
    }[];
  };
  categoryDistribution: DistributionChartData;
  topSpenders: {
    userId: string;
    userName: string;
    totalExpense: number;
  }[];
  trend: TrendChartData;
}

// ==================== Alerts ====================

export interface AlertItem {
  type: AlertType;
  id: string;
  message: string;
  severity: AlertSeverity;
  data: Record<string, any>;
}

export interface AlertsData {
  critical: AlertItem[];
  warning: AlertItem[];
  info: AlertItem[];
  counts: {
    cardExpiry: { expired: number; expiringSoon: number };
    vehicleDocExpiry: { expired: number; expiringSoon: number };
    vehicleServiceDue: { overdue: number; dueSoon: number };
    assetCalibration: { overdue: number; dueSoon: number };
    assetWarranty: { expired: number; expiringSoon: number };
    total: { critical: number; warning: number; info: number };
  };
}

// ==================== Approvals ====================

export interface ApprovalItem {
  id: string;
  userId: string;
  userName: string;
  userProfilePic?: string;
  aging: number;
}

export interface LeaveApprovalItem extends ApprovalItem {
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string;
  appliedAt: string;
}

export interface AttendanceApprovalItem extends ApprovalItem {
  attendanceDate: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

export interface ExpenseApprovalItem extends ApprovalItem {
  category: string;
  amount: number;
  description?: string;
  claimedAt: string;
}

export interface ApprovalsData {
  leave: {
    count: number;
    items: LeaveApprovalItem[];
    aging: { days1: number; days2_3: number; days4Plus: number };
  };
  attendance: {
    count: number;
    items: AttendanceApprovalItem[];
    aging: { days1: number; days2_3: number; days4Plus: number };
  };
  expense: {
    count: number;
    items: ExpenseApprovalItem[];
    aging: { days1: number; days2_3: number; days4Plus: number };
  };
  totals: {
    leave: number;
    attendance: number;
    expense: number;
    total: number;
  };
}

// ==================== Employees ====================

export interface EmployeeBasic {
  userId: string;
  name: string;
  email: string;
  department?: string;
  role?: string;
  profilePicture?: string;
}

export interface NewJoiner extends EmployeeBasic {
  dateOfJoining: string;
}

export interface ExitingEmployee extends EmployeeBasic {
  lastWorkingDate: string;
  daysRemaining: number;
}

export interface ProbationEmployee extends EmployeeBasic {
  dateOfJoining: string;
  employeeType: string;
}

export interface EmployeesData {
  summary: {
    total: number;
    active: number;
    inactive: number;
    onProbation: number;
  };
  newJoiners: {
    count: number;
    items: NewJoiner[];
  };
  exiting: {
    count: number;
    items: ExitingEmployee[];
  };
  onProbation: {
    count: number;
    items: ProbationEmployee[];
  };
  roleDistribution: DistributionChartData;
  departmentDistribution: DistributionChartData;
}

// ==================== Team (Manager) ====================

export interface TeamMember extends EmployeeBasic {
  todayStatus: string;
  presentDaysThisMonth: number;
  leaveDaysThisMonth: number;
  leaveBalance: number;
}

export interface TeamData {
  overview: {
    totalMembers: number;
    todayPresent: number;
    todayAbsent: number;
    todayOnLeave: number;
  };
  pendingApprovals: {
    leave: number;
    attendance: number;
    total: number;
  };
  members: TeamMember[];
  upcomingLeaves: {
    userId: string;
    userName: string;
    fromDate: string;
    toDate: string;
    leaveType: string;
  }[];
  leaveConflicts: {
    date: string;
    employees: string[];
    count: number;
  }[];
  attendanceTrend: TrendChartData;
}

// ==================== Main Response ====================

export interface DashboardResponse {
  overview?: OverviewData;
  birthdays?: BirthdayData;
  anniversaries?: AnniversaryData;
  festivals?: FestivalData;
  attendance?: AttendanceData;
  leave?: LeaveData;
  payroll?: PayrollData;
  expenses?: ExpenseData;
  alerts?: AlertsData;
  approvals?: ApprovalsData;
  employees?: EmployeesData;
  team?: TeamData;
}
