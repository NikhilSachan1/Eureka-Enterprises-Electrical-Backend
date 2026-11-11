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
 * Record a TDS challan deposited with the government — PURCHASE side only.
 * The challan is identified by the UTR / reference number of its payment.
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

  @ApiProperty({ description: 'UTR / reference number of the challan payment' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  utrNumber: string;

  @ApiProperty({ description: 'Date of deposit' })
  @IsDateString()
  paymentDate: string;

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
