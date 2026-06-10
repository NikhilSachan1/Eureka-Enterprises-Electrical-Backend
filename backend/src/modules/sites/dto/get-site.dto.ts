import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsBoolean, IsEnum, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { SiteStatus } from '../constants/site.constants';

export class GetSiteDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Search by site name',
    example: 'Power Plant',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by company ID (supports multiple values)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  companyId?: string[];

  @ApiPropertyOptional({
    description: 'Filter by contractor ID (supports multiple values)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  contractorId?: string[];

  @ApiPropertyOptional({
    description: 'Filter by manager name (search)',
  })
  @IsString()
  @IsOptional()
  managerName?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (supports multiple values)',
    enum: SiteStatus,
    isArray: true,
    type: [String],
  })
  @IsArray()
  @IsEnum(SiteStatus, { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  status?: SiteStatus[];

  @ApiPropertyOptional({
    description: 'Filter by city (supports multiple values)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  city?: string[];

  @ApiPropertyOptional({
    description: 'Filter by state (supports multiple values)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  state?: string[];

  @ApiPropertyOptional({
    description: 'Filter by site type (supports multiple values)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  siteTypes?: string[];

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Include contractors in response',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeContractors?: boolean;

  @ApiPropertyOptional({
    description: 'Include company details in response',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCompany?: boolean;
}
