import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  SITE_ALLOCATION_VALIDATION,
  SITE_ALLOCATION_DEFAULTS,
} from '../constants/site-allocation.constants';

/**
 * Individual allocation item - each user can have different parameters
 */
export class AllocationItemDto {
  @ApiProperty({ description: 'Site ID to allocate user to' })
  @IsNotEmpty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ description: 'User ID to allocate' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Date when allocation starts', example: '2024-01-15' })
  @IsNotEmpty()
  @IsDateString()
  allocatedAt: string;

  @ApiPropertyOptional({
    description: 'Type of allocation',
    default: SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allocationType?: string;

  @ApiPropertyOptional({
    description: 'Role at the site',
    default: SITE_ALLOCATION_DEFAULTS.ROLE,
  })
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

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/**
 * Individual deallocation item - each allocation can have different parameters
 */
export class DeallocationItemDto {
  @ApiProperty({ description: 'Allocation ID to deallocate' })
  @IsNotEmpty()
  @IsUUID()
  allocationId: string;

  @ApiProperty({ description: 'Date when deallocation occurred', example: '2024-01-20' })
  @IsNotEmpty()
  @IsDateString()
  deallocatedAt: string;

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/**
 * Main DTO for managing site allocations
 * Supports both allocations and deallocations in a single request
 * Each item can have different parameters
 */
export class ManageSiteAllocationDto {
  @ApiPropertyOptional({
    description: 'Array of allocations to create (each can have different parameters)',
    type: [AllocationItemDto],
    example: [
      {
        siteId: 'site-uuid',
        userId: 'user-uuid-1',
        allocatedAt: '2024-01-15',
        role: 'Engineer',
        allocationType: 'full_time',
      },
      {
        siteId: 'site-uuid',
        userId: 'user-uuid-2',
        allocatedAt: '2024-01-16',
        role: 'Supervisor',
        dailyAllowance: 500,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  @ValidateIf((o) => !o.deallocations?.length) // At least one of allocations or deallocations required
  allocations?: AllocationItemDto[];

  @ApiPropertyOptional({
    description: 'Array of deallocations to perform (each can have different parameters)',
    type: [DeallocationItemDto],
    example: [
      {
        allocationId: 'allocation-uuid-1',
        deallocatedAt: '2024-01-20',
      },
      {
        allocationId: 'allocation-uuid-2',
        deallocatedAt: '2024-01-21',
        remarks: 'Project completed',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeallocationItemDto)
  @ValidateIf((o) => !o.allocations?.length) // At least one of allocations or deallocations required
  deallocations?: DeallocationItemDto[];
}
