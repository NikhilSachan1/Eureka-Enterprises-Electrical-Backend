import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

/** multipart/form-data sends numbers as strings; also strips thousands separators */
export function parseMultipartOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isNaN(n) ? undefined : n;
}

export class CreateSiteDocumentDto {
  @ApiPropertyOptional({
    description: 'Document file to upload',
    type: 'string',
    format: 'binary',
  })
  siteDocumentFiles?: any;

  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  @IsNotEmpty()
  siteId: string;

  @ApiPropertyOptional({ description: 'Contractor ID (optional for site-level documents)' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiProperty({ description: 'Document type (PO, INVOICE, CONTRACT, etc.)', example: 'PO' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentType: string;

  @ApiPropertyOptional({
    description: 'Document direction: PAYABLE (expense) or RECEIVABLE (income)',
    example: 'PAYABLE',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  direction?: string;

  @ApiPropertyOptional({
    description: 'Document number (optional for informal docs)',
    example: 'PO-2026-001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  documentNumber?: string;

  @ApiProperty({ description: 'Document date', example: '2026-01-15' })
  @IsDateString()
  @IsNotEmpty()
  documentDate: string;

  @ApiPropertyOptional({
    description: 'Base amount (optional for non-financial docs)',
    example: 10000.0,
  })
  @Transform(({ value }) => parseMultipartOptionalNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'GST amount', example: 1800.0 })
  @Transform(({ value }) => parseMultipartOptionalNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gstAmount?: number;

  @ApiPropertyOptional({ description: 'Total amount (auto-calculated if not provided)' })
  @Transform(({ value }) => parseMultipartOptionalNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Document status', example: 'DRAFT' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional({ description: 'Payment status', example: 'PENDING' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Payment date', example: '2026-02-15' })
  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Payment reference/transaction ID' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  paymentReference?: string;

  @ApiPropertyOptional({ description: 'Payment due date', example: '2026-02-28' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Remarks/notes' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
