import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  EntrySourceType,
  AttendanceType,
  AttendanceAction,
} from '../constants/attendance.constants';
import { ApiProperty } from '@nestjs/swagger';

export class AttendanceActionDto {
  @ApiProperty({
    description: 'The action to perform',
    enum: AttendanceAction,
    example: 'checkIn',
  })
  @IsNotEmpty()
  @IsEnum(AttendanceAction)
  action: AttendanceAction;

  @ApiProperty({
    description: 'The notes to perform',
    example: 'I am going to work',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(EntrySourceType)
  @IsOptional()
  entrySourceType: EntrySourceType;

  @IsEnum(AttendanceType)
  @IsOptional()
  attendanceType: AttendanceType;
}
