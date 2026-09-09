import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Record an advance paid to a vendor against a PO, before any JMC/invoice exists.
 *
 * `advanceNumber` is deliberately absent — it is generated server-side from the
 * `advance_number_config` config, the same way vendor codes and PO numbers are.
 *
 * There is no taxable / GST / TDS split: an advance carries a single final amount.
 */
export class CreateAdvancePaymentDto {
  @ApiProperty({ description: 'PO this advance is paid against (must be an APPROVED PURCHASE PO)' })
  @IsNotEmpty()
  @IsUUID()
  poId: string;

  @ApiProperty({ description: 'Date the advance was paid', example: '2026-09-05' })
  @IsNotEmpty()
  @IsDateString()
  advanceDate: string;

  @ApiProperty({ description: 'Final amount paid. No tax breakup.', example: 50000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Advance amount must be greater than zero.' })
  amount: number;

  @ApiPropertyOptional({
    description:
      "The vendor's own reference number for the advance. Optional — many vendors do not issue one.",
    example: 'ADV/2026/0042',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendorAdvanceNumber?: string;

  @ApiPropertyOptional({
    description:
      "Storage key of the vendor's temporary/'kind of' invoice justifying the advance. Upload the file first, then pass its key — same as site invoices.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Original file name of the attachment' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: 'Free-text remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
