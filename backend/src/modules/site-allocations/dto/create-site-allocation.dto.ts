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
import {
  SITE_ALLOCATION_VALIDATION,
  SITE_ALLOCATION_DEFAULTS,
} from '../constants/site-allocation.constants';

export class CreateSiteAllocationDto {
  @IsNotEmpty()
  @IsUUID()
  siteId: string;

  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  allocationType?: string = SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string = SITE_ALLOCATION_DEFAULTS.ROLE;

  @IsOptional()
  @IsNumber()
  @Min(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MIN)
  @Max(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MAX)
  dailyAllowance?: number = SITE_ALLOCATION_DEFAULTS.DAILY_ALLOWANCE;

  @IsNotEmpty()
  @IsDateString()
  allocatedAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
