import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsInt, Min, IsEnum, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartyType } from 'src/modules/common/financials/financial.constants';

export class GetGstRegisterDto {
  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ enum: PartyType, description: 'Filter by party type' })
  @IsEnum(PartyType)
  @IsOptional()
  partyType?: PartyType;

  @ApiPropertyOptional({ description: 'Filter by invoice month (YYYY-MM)' })
  @IsString()
  @IsOptional()
  month?: string;

  @ApiPropertyOptional({ description: 'Filter by financial year (e.g., "2526")' })
  @IsString()
  @IsOptional()
  financialYear?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Filter by contractor ID' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Filter by verification status' })
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortField?: string;

  @ApiPropertyOptional({ description: 'Sort order (ASC/DESC)', default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}
