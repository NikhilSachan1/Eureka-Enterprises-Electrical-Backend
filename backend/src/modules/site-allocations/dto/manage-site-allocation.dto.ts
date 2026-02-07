import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  Min,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SITE_ALLOCATION_VALIDATION,
  SITE_ALLOCATION_DEFAULTS,
} from '../constants/site-allocation.constants';
import { AllocationAction } from '../constants/site-allocation.constants';

export class ManageSiteAllocationDto {
  @ApiProperty({
    description: 'Action to perform',
    enum: AllocationAction,
    example: AllocationAction.ALLOCATE,
  })
  @IsNotEmpty()
  @IsEnum(AllocationAction)
  action: AllocationAction;

  // Required for ALLOCATE action
  @ApiPropertyOptional({ description: 'Site ID to allocate user to (required for allocate)' })
  @ValidateIf((o) => o.action === AllocationAction.ALLOCATE)
  @IsNotEmpty()
  @IsUUID()
  siteId?: string;

  // Required for ALLOCATE action
  @ApiPropertyOptional({ description: 'User ID to allocate (required for allocate)' })
  @ValidateIf((o) => o.action === AllocationAction.ALLOCATE)
  @IsNotEmpty()
  @IsUUID()
  userId?: string;

  // Required for DEALLOCATE action
  @ApiPropertyOptional({ description: 'Allocation ID to deallocate (required for deallocate)' })
  @ValidateIf((o) => o.action === AllocationAction.DEALLOCATE)
  @IsNotEmpty()
  @IsUUID()
  allocationId?: string;

  @ApiPropertyOptional({
    description: 'Type of allocation',
    default: SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allocationType?: string;

  @ApiPropertyOptional({ description: 'Role at the site', default: SITE_ALLOCATION_DEFAULTS.ROLE })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiPropertyOptional({
    description: 'Daily allowance amount',
    default: SITE_ALLOCATION_DEFAULTS.DAILY_ALLOWANCE,
  })
  @IsOptional()
  @IsNumber()
  @Min(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MIN)
  @Max(SITE_ALLOCATION_VALIDATION.DAILY_ALLOWANCE_MAX)
  dailyAllowance?: number;

  // Required for ALLOCATE - allocation start date
  @ApiPropertyOptional({
    description: 'Date when allocation started (required for allocate)',
    example: '2024-01-15',
  })
  @ValidateIf((o) => o.action === AllocationAction.ALLOCATE)
  @IsNotEmpty()
  @IsDateString()
  allocatedAt?: string;

  // Required for DEALLOCATE - deallocation date
  @ApiPropertyOptional({
    description: 'Date when deallocation occurred (required for deallocate)',
    example: '2024-01-20',
  })
  @ValidateIf((o) => o.action === AllocationAction.DEALLOCATE)
  @IsNotEmpty()
  @IsDateString()
  deallocatedAt?: string;

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
