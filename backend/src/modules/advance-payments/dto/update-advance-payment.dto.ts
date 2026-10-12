import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Every field optional — an advance can only be edited while it is unbooked and unsettled, so this
 * is a light correction path rather than a full replace.
 *
 * `poId` is intentionally not editable: moving an advance to a different PO would invalidate the
 * headroom check it was created under and silently corrupt both POs' rollups. Delete and recreate
 * instead (possible only while it is still unlocked).
 */
export class UpdateAdvancePaymentDto {
  @ApiPropertyOptional({ description: 'Date the advance was paid' })
  @IsOptional()
  @IsDateString()
  advanceDate?: string;

  @ApiPropertyOptional({ description: 'Final amount paid. No tax breakup.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Advance amount must be greater than zero.' })
  amount?: number;

  @ApiPropertyOptional({ description: "The vendor's own reference number" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendorAdvanceNumber?: string;

  @ApiPropertyOptional({ description: 'Storage key of the attachment' })
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
