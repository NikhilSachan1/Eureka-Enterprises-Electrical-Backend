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

/**
 * Create Site Document DTO - Repurposed for non-financial documents only.
 * 
 * Financial fields (direction, gstAmount, totalAmount, paymentStatus, paymentDate,
 * paymentReference, dueDate) have been removed.
 * 
 * For financial documents, use dedicated modules:
 * - purchase-orders, site-invoices, bank-transfers, etc.
 */
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

  @ApiPropertyOptional({ description: 'Contractor ID (optional)' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Vendor ID (optional)' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiProperty({
    description: 'Document type (CONTRACT, WORK_ORDER, COMPLETION_CERTIFICATE, PHOTO, INSPECTION_REPORT, OTHER). PO and INVOICE are NOT allowed.',
    example: 'CONTRACT',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentType: string;

  @ApiPropertyOptional({
    description: 'Document number (optional for informal docs like photos)',
    example: 'CONTRACT-2026-001',
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
    description: 'Informational amount (for rough quote reference only, not for financial calculations)',
    example: 10000.0,
  })
  @Transform(({ value }) => parseMultipartOptionalNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Document status', example: 'DRAFT' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional({ description: 'Remarks/notes' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
