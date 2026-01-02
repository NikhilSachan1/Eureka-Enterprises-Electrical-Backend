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
