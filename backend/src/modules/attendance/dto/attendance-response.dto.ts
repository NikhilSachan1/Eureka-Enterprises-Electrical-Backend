import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AttendanceStatus,
  ApprovalStatus,
  AttendanceType,
} from '../constants/attendance.constants';
import { AssignmentSnapshotDto } from './attendance-action.dto';

export class AttendanceStatsDto {
  @ApiProperty({ example: { present: 5, absent: 2, leave: 1, halfDay: 0, total: 8 } })
  attendance: Record<string, number>;

  @ApiProperty({ example: { pending: 3, approved: 4, rejected: 1, total: 8 } })
  approval: Record<string, number>;
}

export class AttendanceRecordDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  };

  @ApiProperty()
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  };

  @ApiProperty()
  approvalBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  };

  @ApiProperty()
  attendanceDate: string;

  @ApiProperty()
  checkInTime?: string;

  @ApiProperty()
  checkOutTime?: string;

  @ApiProperty()
  status: AttendanceStatus;

  @ApiProperty()
  approvalStatus: ApprovalStatus;

  @ApiProperty({ enum: AttendanceType, description: 'Type: self, regularized, or forced' })
  attendanceType: AttendanceType;

  @ApiProperty()
  workDuration?: number;

  @ApiProperty()
  notes?: string;

  @ApiPropertyOptional({
    type: AssignmentSnapshotDto,
    description: 'Site, company, contractors, vehicle, and assigned engineer at time of attendance',
  })
  @ApiPropertyOptional({
    description:
      'The project this employee was allocated to on this date, with the details the attendance ' +
      'screens show. Resolved from the allocation every time it is read, never stored on the ' +
      'attendance row — so correcting an allocation shows up here immediately, on every day it ' +
      'covers, without anyone re-editing attendance. Null when there is no allocation for the date.',
  })
  site?: {
    id: string;
    name: string;
    fullAddress: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    status: string | null;
    startDate: string | null;
    managerName: string | null;
  } | null;

  assignmentSnapshot?: AssignmentSnapshotDto;

  @ApiPropertyOptional({
    type: [Object],
    description:
      'Drivers paired with this person on this date. Read from driver_day_assignments, not from ' +
      'the attendance row. Empty for anyone who is not an engineer holding drivers that day.',
  })
  assignedDrivers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  }>;
}

export class AttendanceListResponseDto {
  @ApiProperty()
  stats?: AttendanceStatsDto;

  @ApiProperty({ type: [AttendanceRecordDto] })
  records: AttendanceRecordDto[];

  @ApiProperty({ example: 100 })
  totalRecords: number;
}
