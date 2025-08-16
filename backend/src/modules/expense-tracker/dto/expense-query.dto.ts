import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsDateString, IsEnum, IsArray, IsString } from 'class-validator';
import { BaseGetDto } from '../../../utils/base-dto/base-get-dto';
import { ApprovalStatus } from '../constants/expense-tracker.constants';

export class ExpenseQueryDto extends BaseGetDto {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2024-01-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)', example: '2024-01-31', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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
    description: 'Search by name/email/employee ID',
    example: 'john',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
