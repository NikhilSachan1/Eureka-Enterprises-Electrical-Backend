import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

/**
 * Settle a chosen advance against this invoice.
 *
 * Both the advance and the amount are the caller's decision — the service only enforces that the
 * money exists on both sides (advance balance, invoice due) and that the two share a PO.
 */
export class SettleAdvanceDto {
  @ApiProperty({ description: 'The advance payment to settle from (APPROVED, same PO)' })
  @IsNotEmpty()
  @IsUUID()
  advancePaymentId: string;

  @ApiProperty({
    description:
      'Amount to settle. May be less than either balance — partial settlement is allowed.',
    example: 40000,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Settlement amount must be greater than zero.' })
  amount: number;
}
