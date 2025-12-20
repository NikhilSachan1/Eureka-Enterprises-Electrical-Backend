import { ApiProperty } from '@nestjs/swagger';
import {
  AttendanceStatus,
  ApprovalStatus,
  AttendanceType,
} from '../constants/attendance.constants';

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
}

export class AttendanceListResponseDto {
  @ApiProperty()
  stats?: AttendanceStatsDto;

  @ApiProperty({ type: [AttendanceRecordDto] })
  records: AttendanceRecordDto[];

  @ApiProperty({ example: 100 })
  totalRecords: number;
}
