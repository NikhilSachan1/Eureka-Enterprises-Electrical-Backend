import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetSiteActivityDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Search by site name',
    example: 'Power Plant',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by site ID (supports multiple values)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  siteId?: string[];

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
    description: 'Filter by vendor ID (supports multiple values)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  vendorId?: string[];

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
    description: 'Filter by employee name (first name, last name, or full name)',
    example: 'Rahul',
  })
  @IsString()
  @IsOptional()
  employeeName?: string;
}
