import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookPaymentDto {
  @ApiProperty({ description: 'Invoice ID (must be PURCHASE side, APPROVED)' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ description: 'Booking date' })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({ description: 'Taxable amount (pre-GST work amount)' })
  @IsNumber()
  @Min(0)
  taxableAmount: number;

  @ApiPropertyOptional({ description: 'GST amount', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  gstAmount?: number;

  @ApiPropertyOptional({ description: 'GST percentage (informational only)', example: 18 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  gstPercentage?: number;

  @ApiPropertyOptional({
    description: 'Net payment hold amount withheld for operational reasons',
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  paymentHoldAmount?: number;

  @ApiPropertyOptional({
    description: 'Reason if payment is on hold (required when paymentHoldAmount > 0)',
  })
  @IsString()
  @IsOptional()
  paymentHoldReason?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
