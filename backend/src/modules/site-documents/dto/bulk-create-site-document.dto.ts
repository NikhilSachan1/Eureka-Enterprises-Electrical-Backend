import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseMultipartOptionalNumber } from './create-site-document.dto';

// Helper to parse JSON string to object (for multipart/form-data)
const parseJsonString = (value: any) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

/**
 * Document Metadata DTO - Repurposed for non-financial documents only.
 * 
 * Financial fields (gstAmount, totalAmount, paymentStatus, dueDate) have been removed.
 */
export class DocumentMetadataDto {
  @ApiPropertyOptional({ description: 'Document number', example: 'CONTRACT-2026-001' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  documentNumber?: string;

  @ApiProperty({ description: 'Document date', example: '2026-01-15' })
  @IsDateString()
  @IsNotEmpty()
  documentDate: string;

  @ApiPropertyOptional({
    description: 'Informational amount (for rough quote reference only)',
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
  status?: string;

  @ApiPropertyOptional({ description: 'Remarks/notes' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

/**
 * Bulk Create Site Document DTO - Repurposed for non-financial documents only.
 * 
 * PO and Invoice fields have been removed. For financial documents, use:
 * - purchase-orders module
 * - site-invoices module
 */
export class BulkCreateSiteDocumentDto {
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

  @ApiPropertyOptional({ description: 'Contract metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  contract?: DocumentMetadataDto;

  @ApiPropertyOptional({ description: 'Work Order metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  workOrder?: DocumentMetadataDto;

  @ApiPropertyOptional({ description: 'Completion Certificate metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  completionCertificate?: DocumentMetadataDto;

  @ApiPropertyOptional({ description: 'Photo metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  photo?: DocumentMetadataDto;

  @ApiPropertyOptional({ description: 'Inspection Report metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  inspectionReport?: DocumentMetadataDto;

  @ApiPropertyOptional({ description: 'Other document metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  other?: DocumentMetadataDto;
}
