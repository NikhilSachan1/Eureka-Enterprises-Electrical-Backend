import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsDateString,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PartyType } from 'src/modules/common/financials/financial.constants';
import { PoItemDto } from './po-item.dto';

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID('4')
  siteId: string;

  @ApiProperty({ description: 'Party type', enum: PartyType })
  @IsEnum(PartyType)
  partyType: PartyType;

  @ApiPropertyOptional({ description: 'Contractor ID (required if partyType=SALE)' })
  @IsUUID('4')
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Vendor ID (required if partyType=PURCHASE)' })
  @IsUUID('4')
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({
    description: 'PO Number. Optional — omit to auto-generate (system-generated flow).',
    example: 'PO/2627/0001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  poNumber?: string;

  @ApiProperty({ description: 'PO Date (ISO)', example: '2026-04-01' })
  @IsDateString()
  poDate: string;

  @ApiPropertyOptional({
    description: 'Taxable amount. Optional for system-generated PO (computed from items).',
    example: 100000,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  taxableAmount?: number;

  @ApiPropertyOptional({ description: 'GST amount', example: 18000, default: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstAmount?: number = 0;

  @ApiPropertyOptional({ description: 'GST percentage', example: 18 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstPercentage?: number;

  @ApiPropertyOptional({ description: 'Tax split for PDF', enum: ['CGST_SGST', 'IGST'] })
  @IsIn(['CGST_SGST', 'IGST'])
  @IsOptional()
  gstType?: 'CGST_SGST' | 'IGST';

  @ApiPropertyOptional({
    description: 'Total amount (= taxable + GST). Optional for system-generated PO (computed).',
    example: 118000,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({
    type: [PoItemDto],
    description:
      'Line items (system-generated PURCHASE PO). Presence marks the PO system-generated.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PoItemDto)
  items?: PoItemDto[];

  @ApiPropertyOptional({
    description: 'S3 file key of an uploaded PO scan. Optional (not used for system-generated PO).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsOptional()
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  remarks?: string;
}
