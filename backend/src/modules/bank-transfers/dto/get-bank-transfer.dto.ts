import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsArray,
  IsUUID,
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { PartyType } from 'src/modules/common/financials/financial.constants';

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value as string];
}

export class GetBankTransferDto {
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

  @ApiPropertyOptional({ enum: PartyType, description: 'Filter by party type' })
  @IsEnum(PartyType)
  @IsOptional()
  partyType?: PartyType;

  @ApiPropertyOptional({ description: 'Filter by invoice ID' })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Filter by book payment ID' })
  @IsUUID()
  @IsOptional()
  bookPaymentId?: string;

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

  @ApiPropertyOptional({ description: 'Filter by financial year (e.g., "2526")' })
  @IsString()
  @IsOptional()
  financialYear?: string;

  @ApiPropertyOptional({
    description: 'Date range start on transferDate (ISO date string, inclusive)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Date range end on transferDate (ISO date string, inclusive)',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search by UTR number' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Search by parent PO number (partial, case-insensitive)' })
  @IsString()
  @IsOptional()
  poNumber?: string;

  @ApiPropertyOptional({
    description: 'Search by parent invoice number (partial, case-insensitive)',
  })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

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
