import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

/**
 * Helper to transform comma-separated string to array
 */
const transformToArray = ({ value }: { value: string | string[] }) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v);
};

export class GetCompanyDto extends BaseGetDto {
  @ApiProperty({
    description: 'Search by company name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by city (supports comma-separated values for multi-select)',
    required: false,
    example: 'Mumbai,Pune,Ahmedabad',
  })
  @IsOptional()
  @Transform(transformToArray)
  @IsArray()
  @IsString({ each: true })
  city?: string[];

  @ApiProperty({
    description: 'Filter by state (supports comma-separated values for multi-select)',
    required: false,
    example: 'Maharashtra,Gujarat',
  })
  @IsOptional()
  @Transform(transformToArray)
  @IsArray()
  @IsString({ each: true })
  state?: string[];

  @ApiProperty({
    description: 'Filter by parent company ID (supports comma-separated UUIDs for multi-select)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000,223e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @Transform(transformToArray)
  @IsArray()
  @IsString({ each: true })
  parentCompanyId?: string[];

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Include only root companies (no parent)',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyRootCompanies?: boolean;

  @ApiProperty({
    description: 'Include child companies in response',
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeChildren?: boolean;
}
