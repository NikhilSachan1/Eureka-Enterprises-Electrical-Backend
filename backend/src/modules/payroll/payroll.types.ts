import { HolidayWorkCompensationType } from './constants/payroll.constants';
export interface WorkingDaysConfig {
  excludeSundays: boolean;
  excludeSaturdays: boolean;
  useHolidayCalendar: boolean;
  defaultWorkingDays: number;
}

export interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  holidays: number;
}

export interface LeaveSummaryItem {
  leaveCategory: string;
  leaveType: string;
  count: number;
}

export interface HolidayWorkCompensationConfig {
  type: HolidayWorkCompensationType;
  leaveCategory?: string;
  leavePerHoliday?: number;
}

// FNF Salary Calculation Types
export interface FnfSalaryCalculationInput {
  userId: string;
  lastWorkingDate: Date;
}

export interface FnfSalaryBreakdown {
  // Days
  totalDaysInMonth: number;
  totalWorkingDaysInMonth: number;
  daysWorked: number;
  prorateMultiplier: number;
  // Earnings (pro-rated)
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
  // Deductions (pro-rated)
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
  // Net
  netSalary: number;
  dailySalary: number;
}
