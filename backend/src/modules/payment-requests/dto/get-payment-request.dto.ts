import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsUUID, IsArray, IsIn, IsInt, Min, IsString } from 'class-validator';

export class GetPaymentRequestDto {
  @ApiPropertyOptional({ type: [String], description: 'Filter by site IDs' })
  @Transform(({ value }) => (Array.isArray(value) ? value : value != null ? [value] : undefined))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteId?: string[];

  @ApiPropertyOptional({ description: 'Filter by invoice' })
  @IsOptional()
  @IsUUID('4')
  invoiceId?: string;

  // Company is reached through the site; vendor through the invoice. Both are offered as
  // an ID list (matching book-payments/bank-transfers, i.e. what a dropdown sends) and as a
  // partial name (for a free-text box). Use whichever the screen has — they combine as AND.
  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more company IDs' })
  @Transform(({ value }) => (Array.isArray(value) ? value : value != null ? [value] : undefined))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  companyId?: string[];

  @ApiPropertyOptional({ description: 'Search by company name (partial, case-insensitive)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more vendor IDs' })
  @Transform(({ value }) => (Array.isArray(value) ? value : value != null ? [value] : undefined))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vendorId?: string[];

  @ApiPropertyOptional({ description: 'Search by vendor name (partial, case-insensitive)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  vendorName?: string;

  // Named `invoiceNumber` rather than `search` to match book-payments and bank-transfers,
  // where the invoice is likewise a parent document. (In site-invoices the invoice *is* the
  // entity, so there `search` is the one that hits the invoice number.)
  @ApiPropertyOptional({
    description: 'Search by parent invoice number (partial, case-insensitive)',
    example: 'INV-2026',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}
