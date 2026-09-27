import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  MaxLength,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Exactly one of `jmcId` or `noJmc` identifies what the invoice hangs off.
 *
 * The No-JMC route exists only for SUPPLY_ITEM purchase orders — material supply has nothing to
 * measure and certify. Everything else about the invoice is unchanged either way.
 */
export class CreateSiteInvoiceDto {
  @ApiPropertyOptional({
    description: 'Parent JMC ID. Required unless `noJmc` is true.',
  })
  @ValidateIf((o) => o.noJmc !== true)
  @IsUUID('4')
  jmcId?: string;

  @ApiPropertyOptional({
    description:
      'Raise this invoice without a JMC. Allowed only when the PO is SUPPLY_ITEM. ' +
      'Send `poId` with it, and leave `jmcId` out.',
  })
  @IsOptional()
  @IsBoolean()
  noJmc?: boolean;

  @ApiPropertyOptional({ description: 'Purchase order. Required when `noJmc` is true.' })
  @ValidateIf((o) => o.noJmc === true)
  @IsUUID('4')
  poId?: string;

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
