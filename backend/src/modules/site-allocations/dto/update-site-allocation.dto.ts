import { IsOptional, IsString, IsNumber, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SITE_ALLOCATION_VALIDATION } from '../constants/site-allocation.constants';

export class UpdateSiteAllocationDto {
  @ApiPropertyOptional({ description: 'Type of allocation' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allocationType?: string;

  @ApiPropertyOptional({ description: 'Role at the site' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiPropertyOptional({ description: 'Daily allowance amount' })
  @IsOptional()
  @IsNumber()
  @Min(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MIN)
  @Max(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MAX)
  dailyAllowance?: number;

  @ApiPropertyOptional({
    description: 'Move the start date. Checked against the employee’s other allocations.',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsDateString()
  allocatedAt?: string;

  @ApiPropertyOptional({
    description:
      'Move the end date (inclusive), or send null to reopen it. Checked against the employee’s ' +
      'other allocations: a change that enlarges an existing clash is refused, shrinking is not.',
    example: '2024-01-20',
  })
  @IsOptional()
  @IsDateString()
  deallocatedAt?: string | null;

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
