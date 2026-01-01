export interface CreateLeaveBalanceDto {
  userId: string;
  leaveConfigId: string;
  leaveCategory: string;
  financialYear: string;
  totalAllocated: string;
  creditSource: string;
  notes?: string;
  createdBy?: string;
}
