import { ApiProperty } from '@nestjs/swagger';

export class UserInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  employeeId: string;
}

export class DateRangeDto {
  @ApiProperty({ example: '2025-12-10' })
  from: string;

  @ApiProperty({ example: '2025-12-14' })
  to: string;
}

export class LeaveApplicationStatsDto {
  @ApiProperty({ example: { total: 100, pending: 10, approved: 80, rejected: 5, cancelled: 5 } })
  approval: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };

  @ApiProperty({ example: { totalCredited: 100, totalConsumed: 50, totalBalance: 50 } })
  leaveBalance: {
    totalCredited: number;
    totalConsumed: number;
    totalBalance: number;
  };
}

export class LeaveApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  leaveType: string;

  @ApiProperty()
  leaveCategory: string;

  @ApiProperty()
  leaveApplicationType: string;

  @ApiProperty()
  fromDate: string;

  @ApiProperty()
  toDate: string;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  approvalStatus: string;

  @ApiProperty()
  approvalAt: string;

  @ApiProperty()
  approvalBy: string;

  @ApiProperty()
  approvalReason: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  entrySourceType: string;

  @ApiProperty({ type: UserInfoDto, nullable: true })
  approvalByUser: UserInfoDto | null;

  @ApiProperty({ type: UserInfoDto, nullable: true })
  user: UserInfoDto | null;

  @ApiProperty({ type: UserInfoDto, nullable: true })
  createdByUser: UserInfoDto | null;
}

export class LeaveGroupDto {
  @ApiProperty({ type: DateRangeDto, description: 'Date range for this group' })
  dateRange: DateRangeDto;

  @ApiProperty({ example: 'pending', description: 'Approval status for all records in this group' })
  approvalStatus: string;

  @ApiProperty({
    example: 'Sick Leave',
    description: 'Leave category for all records in this group',
  })
  leaveCategory: string;

  @ApiProperty({ example: 'fullDay', description: 'Leave type for all records in this group' })
  leaveType: string;

  @ApiProperty({ example: 5, description: 'Number of leave days in this group' })
  count: number;

  @ApiProperty({ example: 'Not feeling well', description: 'Reason from the first record' })
  reason: string;

  @ApiProperty({ example: '2025-12-05T10:30:00Z', description: 'Earliest createdAt in the group' })
  createdAt: string;

  @ApiProperty({
    type: [LeaveApplicationResponseDto],
    description: 'Individual leave records in this group',
  })
  records: LeaveApplicationResponseDto[];
}

export class UserLeaveGroupDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ type: UserInfoDto, description: 'User information' })
  user: UserInfoDto;

  @ApiProperty({ type: [LeaveGroupDto], description: 'Leave groups for this user' })
  leaveGroups: LeaveGroupDto[];
}

export class LeaveApplicationListResponseDto {
  @ApiProperty()
  stats?: LeaveApplicationStatsDto;

  @ApiProperty({ type: [LeaveApplicationResponseDto] })
  records: LeaveApplicationResponseDto[];

  @ApiProperty({ example: 100 })
  totalRecords: number;
}

export class GroupedLeaveApplicationListResponseDto {
  @ApiProperty({ type: LeaveApplicationStatsDto })
  stats?: LeaveApplicationStatsDto;

  @ApiProperty({
    description:
      'Leave applications grouped. For all users: UserLeaveGroupDto[]. For single user: LeaveGroupDto[]',
  })
  groupedRecords: UserLeaveGroupDto[] | LeaveGroupDto[];

  @ApiProperty({ example: 100, description: 'Total number of individual leave records' })
  totalRecords: number;
}
