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
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PartyType } from 'src/modules/common/financials/financial.constants';

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

  @ApiProperty({ description: 'PO Number', example: 'PO/2526/0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  poNumber: string;

  @ApiProperty({ description: 'PO Date (ISO)', example: '2026-04-01' })
  @IsDateString()
  poDate: string;

  @ApiProperty({ description: 'Taxable amount', example: 100000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxableAmount: number;

  @ApiPropertyOptional({ description: 'GST amount', example: 18000, default: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstAmount?: number = 0;

  @ApiPropertyOptional({ description: 'GST percentage (informational only)', example: 18 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  gstPercentage?: number;

  @ApiProperty({ description: 'Total amount (= taxable + GST)', example: 118000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount: number;

  @ApiProperty({ description: 'S3 file key for the PO PDF/scan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileKey: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  remarks?: string;
}
