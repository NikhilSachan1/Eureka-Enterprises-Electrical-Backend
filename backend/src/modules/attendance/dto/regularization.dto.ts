import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import {
  AttendanceStatus,
  AttendanceType,
  EntrySourceType,
} from '../constants/attendance.constants';

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
    description: 'The timezone of the attendance to regularize',
    example: 'Asia/Kolkata',
    required: true,
  })
  @IsString()
  @IsOptional()
  timezone: string;

  @IsEnum(EntrySourceType)
  @IsOptional()
  entrySourceType: EntrySourceType;

  @IsEnum(AttendanceType)
  @IsOptional()
  attendanceType: AttendanceType;
}
