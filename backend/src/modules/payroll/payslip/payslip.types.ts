export interface PayslipCompany {
  name: string;
  address: {
    city: string;
    state: string;
    pincode: string;
  };
  logo?: string;
}

export interface PayslipEmployee {
  name: string;
  employeeId: string;
  designation?: string;
  department?: string;
  dateOfJoining?: string;
  email: string;
  bankAccount?: string;
  bankName?: string;
  bankHolderName?: string;
  ifscCode?: string;
  uanNumber?: string;
}

export interface PayslipPayPeriod {
  month: number;
  year: number;
  monthName: string;
  payDate?: string;
}

export interface PayslipAttendance {
  totalDays: number;
  workingDays: number;
  presentDays: number;
  paidLeaves: number;
  lopDays: number;
  holidays: number;
  weekoffs: number;
  holidaysWorked?: number;
  paidDays?: number;
}

export interface PayslipLeaveBalance {
  earned?: number;
  casual?: number;
  sick?: number;
  total?: number;
}

export interface PayslipItem {
  label: string;
  amount: number;
}

export interface PayslipEarnings {
  items: PayslipItem[];
  total: number;
}

export interface PayslipDeductions {
  items: PayslipItem[];
  total: number;
}

export interface PayslipSummary {
  grossSalary: number;
  totalDeductions: number;
  netPayable: number;
  netPayableInWords: string;
  holidayLeavesCredited?: number;
}

export interface PayslipData {
  company: PayslipCompany;
  employee: PayslipEmployee;
  payPeriod: PayslipPayPeriod;
  attendance: PayslipAttendance;
  earnings: PayslipEarnings;
  deductions: PayslipDeductions;
  summary: PayslipSummary;
  leaveBalance?: PayslipLeaveBalance;
}

export interface GeneratePayslipOptions {
  payrollId: string;
  sendEmail?: boolean;
}
