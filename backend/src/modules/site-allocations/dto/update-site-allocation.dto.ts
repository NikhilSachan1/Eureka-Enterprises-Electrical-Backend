import { IsOptional, IsString, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { SITE_ALLOCATION_VALIDATION } from '../constants/site-allocation.constants';

export class UpdateSiteAllocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allocationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsNumber()
  @Min(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MIN)
  @Max(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MAX)
  dailyAllowance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
