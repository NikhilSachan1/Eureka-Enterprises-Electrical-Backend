import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';

/**
 * Settle held GST from the GST summary (entry-wise bulk selection).
 *   PURCHASE → books a GST release per invoice; it is paid via payment sheet / bank transfer,
 *              so no UTR here. `paymentDate` is the booking date.
 *   SALE     → records the client's payment as a GST bank transfer per invoice. `utrNumber` is
 *              required and `paymentDate` is the date the money was received.
 */
export class CreateGstPaymentDto {
  @ApiProperty({
    description: 'GST register entry IDs to settle (bulk selection)',
    type: [String],
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  entryIds: string[];

  @ApiPropertyOptional({ description: 'UTR / reference number — required for SALE (receipt)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  utrNumber?: string;

  @ApiProperty({ description: 'PURCHASE: booking date. SALE: date the GST was received.' })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional({ description: 'Proof file S3 key (SALE receipt)' })
  @IsString()
  @IsOptional()
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Proof file name (SALE receipt)' })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
