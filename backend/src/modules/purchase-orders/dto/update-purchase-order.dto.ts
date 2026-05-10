import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, IsDateString, MaxLength } from 'class-validator';

/**
 * partyType / siteId / contractorId / vendorId cannot change after creation.
 *
 * Note: numeric fields intentionally do NOT use @Type(() => Number) here.
 * The global ValidationPipe with enableImplicitConversion: true would convert
 * absent numeric fields to 0, making it impossible to distinguish "user sent
 * 0" from "user didn't send the field at all". Without @Type, absent fields
 * stay as undefined and the service can safely apply ??-style fallback.
 */
export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({ description: 'PO Number' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  poNumber?: string;

  @ApiPropertyOptional({ description: 'PO Date (ISO)' })
  @IsDateString()
  @IsOptional()
  poDate?: string;

  @ApiPropertyOptional({ description: 'Taxable amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  taxableAmount?: number;

  @ApiPropertyOptional({ description: 'GST amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstAmount?: number;

  @ApiPropertyOptional({ description: 'GST percentage (informational only)', example: 18 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstPercentage?: number;

  @ApiPropertyOptional({ description: 'Total amount (= taxable + GST)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'S3 file key' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
