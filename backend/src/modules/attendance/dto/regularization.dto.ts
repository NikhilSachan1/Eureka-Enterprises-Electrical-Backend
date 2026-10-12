import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus, AttendanceType } from '../constants/attendance.constants';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { AssignmentSnapshotDto } from './attendance-action.dto';

export class RegularizeAttendanceDto {
  @ApiProperty({
    description: 'The check in time of the attendance to regularize in HH:MM format',
    example: '10:00',
    required: false,
  })
  @ValidateIf((obj) => obj.status === AttendanceStatus.PRESENT)
  @IsNotEmpty({ message: 'Check-in time is required when status is present' })
  @IsString()
  @IsOptional()
  checkInTime: string;

  @ApiProperty({
    description: 'The check out time of the attendance to regularize in HH:MM format',
    example: '18:00',
    required: false,
  })
  @ValidateIf((obj) => obj.status === AttendanceStatus.PRESENT)
  @IsNotEmpty({ message: 'Check-out time is required when status is present' })
  @IsString()
  @IsOptional()
  checkOutTime: string;

  @ApiProperty({
    description: 'The notes of the attendance to regularize',
    example: 'Regularization notes',
    default: '',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes: string;

  @ApiProperty({
    description: 'The status of the attendance to regularize',
    example: 'present',
    required: false,
  })
  @IsString()
  @IsOptional()
  status: AttendanceStatus;

  @ApiProperty({
    description: 'The id of the user of whom the attendance is regularizing',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Leave category to apply when regularizing to leave status',
    example: 'Casual Leave',
    required: false,
  })
  @ValidateIf((obj) => obj.status === AttendanceStatus.LEAVE)
  @IsNotEmpty({ message: 'Leave category is required when status is leave' })
  @IsString()
  leaveCategory?: string;

  @ApiPropertyOptional({
    description:
      'Corrected assignment snapshot. Only `assignedEngineer` is retained, and only for drivers, ' +
      'where changing it re-routes the food allowance for that day. Site, company, contractors ' +
      'and vehicle are accepted and ignored — a wrong project is corrected on the allocation and a ' +
      'wrong vehicle on the handover, and both then show on every day they cover. Omit to keep ' +
      'the existing snapshot.',
    type: AssignmentSnapshotDto,
  })
  @ValidateNested()
  @Type(() => AssignmentSnapshotDto)
  @IsOptional()
  assignmentSnapshot?: AssignmentSnapshotDto;

  @IsEnum(EntrySourceType)
  @IsOptional()
  entrySourceType: EntrySourceType;

  @IsEnum(AttendanceType)
  @IsOptional()
  attendanceType: AttendanceType;

  timezone?: string;
}
