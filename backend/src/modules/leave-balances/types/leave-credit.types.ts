export interface CalendarSettings {
  endMonth: number;
  cycleType: string;
  startMonth: number;
  allowFractional: boolean;
  joiningCutoffDay: number;
  midMonthJoinPolicy: {
    afterCutoff: 'half' | 'none';
    beforeCutoff: 'full';
  };
  defaultLeavePolicyEnabled: boolean;
}

export interface LeaveCategoryConfig {
  annualQuota: number;
  creditFrequency: 'monthly' | 'yearly' | 'quarterly';
  carryForward?: boolean;
  maxCarryForward?: number;
}

export interface LeaveCreditResult {
  userId: string;
  financialYear: string;
  dateOfJoining: Date;
  monthsRemaining: number;
  firstMonthFraction: number;
  categoriesCredited: {
    category: string;
    allocated: number;
    note: string;
  }[];
  errors: string[];
}
