import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

/**
 * Record a TDS challan (ITNS 281) deposited with the government — PURCHASE side only.
 * BSR code + deposit date + challan serial no. identify the challan (CIN).
 */
export class CreateTdsPaymentDto {
  @ApiProperty({
    description: 'PURCHASE-side TDS register entry IDs covered by this challan',
    type: [String],
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  entryIds: string[];

  @ApiProperty({ description: 'BSR code of the bank branch (7 digits)', example: '0510308' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  bsrCode: string;

  @ApiProperty({ description: 'Challan serial number', example: '00123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  challanSerialNumber: string;

  @ApiProperty({ description: 'Date of deposit' })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional({ description: 'Bank reference / UTR of the challan payment' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  utrNumber?: string;

  @ApiPropertyOptional({ description: 'Challan proof file S3 key' })
  @IsString()
  @IsOptional()
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Challan proof file name' })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
