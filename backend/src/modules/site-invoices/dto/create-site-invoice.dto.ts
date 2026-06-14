import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSiteInvoiceDto {
  @ApiProperty({ description: 'Parent JMC ID' })
  @IsUUID('4')
  jmcId: string;

  @ApiPropertyOptional({ description: 'Invoice Number (can be filled later)' })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Invoice Date (ISO) — can be filled later' })
  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @ApiPropertyOptional({ description: 'Taxable amount — can be filled later' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  taxableAmount?: number;

  @ApiPropertyOptional({ description: 'GST amount' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstAmount?: number;

  @ApiPropertyOptional({ description: 'GST percentage (informational only)', example: 18 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstPercentage?: number;

  @ApiPropertyOptional({ description: 'TDS amount (manual entry)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  tdsAmount?: number;

  @ApiPropertyOptional({ description: 'TDS percentage (informational only)', example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  tdsPercentage?: number;

  @ApiPropertyOptional({ description: 'Total amount (= taxable + GST) — can be filled later' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'S3 file key — can be attached later' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Original file name — can be attached later' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({
    description:
      'Set true to withhold GST pending vendor compliance — GST register entry stays pending until verified',
    default: false,
  })
  @IsOptional()
  isGstHold?: boolean = false;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remarks?: string;
}
