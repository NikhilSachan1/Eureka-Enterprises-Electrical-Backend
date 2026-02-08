import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SITE_ALLOCATION_VALIDATION,
  SITE_ALLOCATION_DEFAULTS,
  AllocationAction,
} from '../constants/site-allocation.constants';

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
  @ApiPropertyOptional({ description: 'Site ID to allocate users to (required for allocate)' })
  @ValidateIf((o) => o.action === AllocationAction.ALLOCATE)
  @IsNotEmpty()
  @IsUUID()
  siteId?: string;

  // Required for ALLOCATE action - supports multiple userIds
  @ApiPropertyOptional({
    description: 'User IDs to allocate (required for allocate, supports multiple)',
    example: ['uuid1', 'uuid2'],
    type: [String],
  })
  @ValidateIf((o) => o.action === AllocationAction.ALLOCATE)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  userIds?: string[];

  // Required for DEALLOCATE action - supports multiple allocationIds
  @ApiPropertyOptional({
    description: 'Allocation IDs to deallocate (required for deallocate, supports multiple)',
    example: ['uuid1', 'uuid2'],
    type: [String],
  })
  @ValidateIf((o) => o.action === AllocationAction.DEALLOCATE)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  allocationIds?: string[];

  @ApiPropertyOptional({
    description: 'Type of allocation (applied to all users)',
    default: SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allocationType?: string;

  @ApiPropertyOptional({
    description: 'Role at the site (applied to all users)',
    default: SITE_ALLOCATION_DEFAULTS.ROLE,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiPropertyOptional({
    description: 'Daily allowance amount (applied to all users)',
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
