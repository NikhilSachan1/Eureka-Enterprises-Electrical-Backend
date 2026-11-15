import { LeaveApplicationResponseDto, UserInfoDto } from './dto';

/** One leave submission (apply / force) with all its day rows. */
export interface LeaveApplicationGroupResponse {
  groupId: string;
  userId: string;
  user: UserInfoDto | null;
  leaveType: string;
  leaveCategory: string;
  leaveApplicationType: string;
  entrySourceType: string;
  reason: string;
  fromDate: string;
  toDate: string;
  dayCount: number;
  /** The status of every day, or "mixed" when the days differ. */
  approvalStatus: string;
  statusCounts: { pending: number; approved: number; rejected: number; cancelled: number };
  createdAt: string;
  createdByUser: UserInfoDto | null;
  records: LeaveApplicationResponseDto[];
}

export interface RequestWithTimezone {
  user: { id: string };
  timezone: string;
}
