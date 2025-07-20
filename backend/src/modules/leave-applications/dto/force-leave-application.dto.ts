import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IsValidDate, IsValidDateRange } from '../validators/date-range.validator';

export class ForceLeaveApplicationDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

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
}
