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

// Individual document metadata (without documentType - derived from field name)
export class DocumentMetadataDto {
  @ApiPropertyOptional({ description: 'Document number', example: 'PO-2026-001' })
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
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'GST amount', example: 1800.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  gstAmount?: number;

  @ApiPropertyOptional({ description: 'Total amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Document status', example: 'DRAFT' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Payment status', example: 'PENDING' })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Payment due date', example: '2026-02-28' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Remarks/notes' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class BulkCreateSiteDocumentDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  @IsNotEmpty()
  siteId: string;

  @ApiPropertyOptional({ description: 'Contractor ID (optional for site-level documents)' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Purchase Order metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  po?: DocumentMetadataDto;

  @ApiPropertyOptional({ description: 'Invoice metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  invoice?: DocumentMetadataDto;

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

  @ApiPropertyOptional({ description: 'Other document metadata' })
  @Transform(({ value }) => parseJsonString(value))
  @ValidateNested()
  @Type(() => DocumentMetadataDto)
  @IsOptional()
  other?: DocumentMetadataDto;
}
