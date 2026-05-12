import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsArray, IsUUID, IsString, IsEnum, IsDateString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { PartyType } from 'src/modules/common/financials/financial.constants';

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value as string];
}

export class GetSiteReportDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by parent JMC ID' })
  @IsUUID('4')
  @IsOptional()
  jmcId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more company IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  companyId?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more site IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteId?: string[];

  @ApiPropertyOptional({ enum: PartyType })
  @IsEnum(PartyType)
  @IsOptional()
  partyType?: PartyType;

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more contractor IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contractorId?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more vendor IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vendorId?: string[];

  @ApiPropertyOptional({
    description: 'Date range start on reportDate (ISO date string, inclusive)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Date range end on reportDate (ISO date string, inclusive)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}
