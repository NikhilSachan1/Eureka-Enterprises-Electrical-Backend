export interface FnfSettings {
  noticePeriod: {
    enabled: boolean;
    days: number;
    recoveryEnabled: boolean;
    waiverAllowed: boolean;
  };
  gratuity: {
    enabled: boolean;
    minServiceYears: number;
    formula: string;
    maxAmount: number | null;
  };
  leaveEncashment: {
    enabled: boolean;
    categories: string[];
    paymentMode: 'EXPENSE' | 'SALARY';
    maxDays: number | null;
  };
  expenseSettlement: {
    enabled: boolean;
    includeExpenses: boolean;
    includeFuelExpenses: boolean;
  };
  settlementMode: 'EXPENSE' | 'SALARY';
  assetClearance: {
    enabled: boolean;
    blockFnfIfPending: boolean;
  };
  vehicleClearance: {
    enabled: boolean;
    blockFnfIfPending: boolean;
  };
  cardClearance: {
    enabled: boolean;
    blockFnfIfPending: boolean;
  };
  documents: {
    relievingLetter: boolean;
    experienceLetter: boolean;
    fnfStatement: boolean;
    autoSendEmail: boolean;
  };
}

export interface FnfSalaryBreakdown {
  totalDaysInMonth: number;
  totalWorkingDaysInMonth: number;
  daysWorked: number;
  prorateMultiplier: number;
  basicProrated: number;
  hraProrated: number;
  foodAllowanceProrated: number;
  conveyanceAllowanceProrated: number;
  medicalAllowanceProrated: number;
  specialAllowanceProrated: number;
  grossEarnings: number;
  // Holiday Work Compensation
  holidaysWorked: number;
  holidayBonus: number;
  // Deductions
  employeePfProrated: number;
  tdsProrated: number;
  esicProrated: number;
  professionalTaxProrated: number;
  lopDeduction: number;
  totalDeductions: number;
  // Attendance
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  holidays: number;
  netSalary: number;
  dailySalary: number;
}

export interface ExpenseSettlementResult {
  // Expense Settlement
  pendingExpenseReimbursement: number; // Company owes employee
  unsettledExpenseCredit: number; // Employee owes company
  expenseDetails: {
    pendingDebits: number;
    unsettledCredits: number;
    count: number;
  };
  // Fuel Expense Settlement
  pendingFuelReimbursement: number; // Company owes employee
  unsettledFuelCredit: number; // Employee owes company
  fuelDetails: {
    pendingDebits: number;
    unsettledCredits: number;
    count: number;
  };
}

export interface FnfCalculationResult {
  // Salary Details
  daysWorked: number;
  dailySalary: number;
  finalSalary: number;
  salaryBreakdown: FnfSalaryBreakdown;
  // Leave Encashment
  encashableLeaves: number;
  leaveEncashmentAmount: number;
  // Gratuity
  serviceYears: number;
  gratuityAmount: number;
  // Expense Settlement
  pendingExpenseReimbursement: number;
  unsettledExpenseCredit: number;
  pendingFuelReimbursement: number;
  unsettledFuelCredit: number;
  // Notice Period
  noticePeriodDays: number;
  noticePeriodRecovery: number;
  // Totals
  totalEarnings: number;
  totalDeductions: number;
  netPayable: number;
}

export interface ClearanceCheckResult {
  assets: {
    assigned: number;
    returned: number;
    pending: number;
    items: string[];
  };
  vehicles: {
    assigned: number;
    returned: number;
    pending: number;
    items: string[];
  };
  cards: {
    assigned: number;
    deactivated: number;
    pending: number;
    items: string[];
  };
}

export interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  empCode?: string;
}

export interface ExperienceLetterData {
  companyName: string;
  companyAddress: string;
  companyLogo?: string;
  letterDate: string;
  refNumber: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department?: string;
  dateOfJoining: string;
  lastWorkingDate: string;
  totalExperience: string;
}

export interface FnfStatementData {
  companyName: string;
  companyAddress: string;
  companyLogo?: string;
  statementDate: string;
  refNumber: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department?: string;
  dateOfJoining: string;
  lastWorkingDate: string;
  bankAccount?: string;
  panNumber?: string;
  // Earnings
  daysWorked: number;
  dailySalary: number;
  finalSalary: number;
  encashableLeaves: number;
  leaveEncashmentAmount: number;
  serviceYears: number;
  gratuityAmount: number;
  pendingExpenseReimbursement: number;
  pendingFuelReimbursement: number;
  pendingReimbursements: number;
  otherAdditions: number;
  additionRemarks?: string;
  totalEarnings: number;
  // Deductions
  noticePeriodDays: number;
  noticePeriodRecovery: number;
  unsettledExpenseCredit: number;
  unsettledFuelCredit: number;
  otherDeductions: number;
  deductionRemarks?: string;
  totalDeductions: number;
  // Net
  netPayable: number;
}

export interface RelievingLetterData {
  companyName: string;
  companyAddress: string;
  companyLogo?: string;
  letterDate: string;
  refNumber: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department?: string;
  dateOfJoining: string;
  lastWorkingDate: string;
  exitReason: string;
}

export interface RequestWithTimezone {
  user: { id: string };
  timezone: string;
}
