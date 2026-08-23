import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Only the fields the requester owns are editable. `invoiceId` is deliberately excluded —
 * it is what `siteId` and `poId` are derived from at creation and both are denormalised
 * for the request's lifetime, so pointing a request at a different invoice means deleting
 * it and raising a new one.
 */
export class UpdatePaymentRequestDto {
  @ApiPropertyOptional({ description: 'Requested amount', example: 20000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  requestedAmount?: number;

  @ApiPropertyOptional({ description: 'Reason / details for the request' })
  @IsOptional()
  @IsString()
  reason?: string;
}
