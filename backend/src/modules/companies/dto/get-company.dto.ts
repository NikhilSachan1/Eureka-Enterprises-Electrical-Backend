import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetCompanyDto extends BaseGetDto {
  @ApiProperty({
    description: 'Search by company name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by city',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'Filter by state',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Filter by parent company ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentCompanyId?: string;

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
