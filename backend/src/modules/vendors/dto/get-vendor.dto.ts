import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { VendorType } from '../constants/vendor.constants';

export class GetVendorDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Search by vendor name',
    example: 'XYZ',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by city (supports multiple values)',
    example: ['Mumbai', 'Pune'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  city?: string[];

  @ApiPropertyOptional({
    description: 'Filter by state (supports multiple values)',
    example: ['Maharashtra', 'Gujarat'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  state?: string[];

  @ApiPropertyOptional({
    description: 'Filter by vendor type',
    enum: VendorType,
  })
  @IsEnum(VendorType)
  @IsOptional()
  vendorType?: VendorType;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isActive?: boolean;
}
