import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { AttendanceType, EntrySourceType } from '../constants/attendance.constants';

export class ForceAttendanceDto {
  @ApiProperty({
    description: 'The ID of the user for whom attendance is being forced',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

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
