import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  ApprovalStatus,
  LEAVE_APPLICATION_SORTABLE_FIELDS,
  LeaveType,
} from '../constants/leave-application.constants';

export class GetLeaveApplicationsDto extends BaseGetDto {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2024-01-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)', example: '2024-01-31', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Financial year', example: '2025-2026', required: true })
  @IsString()
  @IsNotEmpty()
  financialYear: string;

  @ApiProperty({
    description: 'Specific date (YYYY-MM-DD)',
    example: '2024-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: 'User IDs', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  userIds?: string[];

  @ApiProperty({
    description: 'Approval statuses',
    enum: ApprovalStatus,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ApprovalStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  approvalStatuses?: ApprovalStatus[];

  @ApiProperty({
    description: 'Leave types',
    enum: LeaveType,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(LeaveType, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  leaveTypes?: LeaveType[];

  @ApiProperty({
    description: 'Search by name/email/employee ID',
    example: 'john',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Sort field',
    enum: Object.keys(LEAVE_APPLICATION_SORTABLE_FIELDS),
    required: false,
  })
  @IsOptional()
  @IsEnum(Object.keys(LEAVE_APPLICATION_SORTABLE_FIELDS), { each: true })
  @IsString()
  sortField?: string;

  @ApiProperty({
    description:
      'Return grouped response (by user, date range, approval status, leave category, leave type). Default: true',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  grouped?: boolean = true;
}
