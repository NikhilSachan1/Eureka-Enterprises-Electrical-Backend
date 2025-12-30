import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsValidDate, IsValidDateRange } from '../validators/date-range.validator';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';

export class CreateLeaveApplicationDto {
  @ApiProperty({
    description: 'Leave type',
    example: 'FULL_DAY',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  leaveType: string;

  @ApiProperty({
    description: 'Leave Category',
    example: 'Earned Leave',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  leaveCategory: string;

  @ApiProperty({
    description: 'From date',
    example: '2025-01-01',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @IsValidDate()
  @IsValidDateRange()
  fromDate: string;

  @ApiProperty({
    description: 'To date',
    example: '2025-01-01',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @IsValidDate()
  toDate: string;

  @ApiProperty({
    description: 'Reason',
    example: 'Sick leave',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsEnum(EntrySourceType)
  @IsOptional()
  entrySourceType: EntrySourceType;

  timezone?: string;
}
