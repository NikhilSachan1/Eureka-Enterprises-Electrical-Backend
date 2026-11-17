import { IsOptional, IsUUID, IsString, IsBoolean, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetSiteAllocationDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Search by user name or site name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by allocation type' })
  @IsOptional()
  @IsString()
  allocationType?: string;

  @ApiPropertyOptional({ description: 'Filter by role' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Filter by current allocation status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isCurrentlyAllocated?: boolean;

  @ApiPropertyOptional({ description: 'Include site details in response' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeSite?: boolean;

  @ApiPropertyOptional({ description: 'Include user details in response' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeUser?: boolean;

  @ApiPropertyOptional({
    description:
      'Start of a period (YYYY-MM-DD): only allocations active on any day from this date are returned',
  })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({
    description:
      'End of a period (YYYY-MM-DD): only allocations active on any day up to this date are returned',
  })
  @IsOptional()
  @IsDateString()
  periodTo?: string;
}
