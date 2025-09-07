import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' } })
  approvalByUser: {
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiProperty({ example: { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' } })
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiProperty({ example: { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' } })
  createdByUser: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export class LeaveApplicationListResponseDto {
  @ApiProperty()
  stats?: LeaveApplicationStatsDto;

  @ApiProperty({ type: [LeaveApplicationResponseDto] })
  records: LeaveApplicationResponseDto[];

  @ApiProperty({ example: 100 })
  totalRecords: number;
}
