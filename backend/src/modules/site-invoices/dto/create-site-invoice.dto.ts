import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
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

  @ApiProperty({ description: 'Invoice Number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  invoiceNumber: string;

  @ApiProperty({ description: 'Invoice Date (ISO)' })
  @IsDateString()
  invoiceDate: string;

  @ApiProperty({ description: 'Taxable amount' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxableAmount: number;

  @ApiPropertyOptional({ description: 'GST amount', default: 0 })
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

  @ApiPropertyOptional({ description: 'TDS amount (manual entry)', default: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  tdsAmount?: number = 0;

  @ApiPropertyOptional({ description: 'TDS percentage (informational only)', example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  tdsPercentage?: number;

  @ApiProperty({ description: 'Total amount (= taxable + GST)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remarks?: string;
}
