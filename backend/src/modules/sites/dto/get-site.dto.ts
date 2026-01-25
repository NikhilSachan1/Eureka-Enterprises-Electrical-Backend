import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsBoolean, IsEnum } from 'class-validator';
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
    description: 'Filter by company ID',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by contractor ID',
  })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by manager name',
  })
  @IsString()
  @IsOptional()
  managerName?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: SiteStatus,
  })
  @IsEnum(SiteStatus)
  @IsOptional()
  status?: SiteStatus;

  @ApiPropertyOptional({
    description: 'Filter by city',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by state',
  })
  @IsString()
  @IsOptional()
  state?: string;

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
