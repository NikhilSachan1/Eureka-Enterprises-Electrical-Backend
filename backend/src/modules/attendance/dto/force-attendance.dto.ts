import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsDateString, IsArray, IsUUID } from 'class-validator';
import { AttendanceType } from '../constants/attendance.constants';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { Transform } from 'class-transformer';

export class ForceAttendanceDto {
  @ApiProperty({ description: 'User IDs', type: [String], required: true })
  @IsArray()
  @IsNotEmpty()
  @IsUUID(4, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  userIds: string[];

  @ApiProperty({
    description: 'The date for which attendance is being forced (YYYY-MM-DD format)',
    example: '2024-01-15',
  })
  @IsDateString()
  @IsNotEmpty()
  attendanceDate: string;

  @ApiProperty({
    description: 'The check-in time in HH:MM format (required for all scenarios)',
    example: '09:30',
  })
  @IsString()
  @IsNotEmpty()
  checkInTime: string;

  @ApiProperty({
    description:
      'The check-out time in HH:MM format (required for previous days and same day after shift)',
    example: '18:00',
    required: false,
  })
  @IsString()
  @IsOptional()
  checkOutTime?: string;

  @ApiProperty({
    description: 'Reason for forcing attendance',
    example: 'Employee forgot to check in due to network issues',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Verified with employee and manager',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  notes: string;

  @ApiProperty({
    description: 'Timezone for the attendance',
    example: 'Asia/Kolkata',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  timezone: string;

  @IsOptional()
  entrySourceType?: EntrySourceType;

  @IsOptional()
  attendanceType?: AttendanceType;
}
