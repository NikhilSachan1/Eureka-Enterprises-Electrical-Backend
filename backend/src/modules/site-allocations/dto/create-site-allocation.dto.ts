import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SITE_ALLOCATION_VALIDATION,
  SITE_ALLOCATION_DEFAULTS,
} from '../constants/site-allocation.constants';

export class CreateSiteAllocationDto {
  @ApiProperty({ description: 'Site ID to allocate user to' })
  @IsNotEmpty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ description: 'User ID to allocate' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: 'Type of allocation',
    default: SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allocationType?: string = SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE;

  @ApiPropertyOptional({ description: 'Role at the site', default: SITE_ALLOCATION_DEFAULTS.ROLE })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string = SITE_ALLOCATION_DEFAULTS.ROLE;

  @ApiPropertyOptional({
    description: 'Daily allowance amount',
    default: SITE_ALLOCATION_DEFAULTS.DAILY_ALLOWANCE,
  })
  @IsOptional()
  @IsNumber()
  @Min(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MIN)
  @Max(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MAX)
  dailyAllowance?: number = SITE_ALLOCATION_DEFAULTS.DAILY_ALLOWANCE;

  @ApiProperty({
    description: 'Date when allocation started (ISO date string)',
    example: '2024-01-15',
  })
  @IsNotEmpty()
  @IsDateString()
  allocatedAt: string;

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
