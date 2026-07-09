import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsArray,
  IsUUID,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value as string];
}

export class GetVendorListQueryDto {
  @ApiPropertyOptional({ description: 'Page number (paginates on vendors)', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size. Omit to return all vendors.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
    description: 'Sort book payments by bookingDate',
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: string = SortOrder.DESC;

  @ApiPropertyOptional({ type: [String], description: 'Filter by vendor IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vendorIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by site IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by company IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  companyIds?: string[];

  @ApiPropertyOptional({ description: 'Filter from bookingDate (inclusive, YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter to bookingDate (inclusive, YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search by vendor name, invoice number or PO number' })
  @IsString()
  @IsOptional()
  search?: string;
}
