import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({ description: 'TDS deduction amount', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  tdsDeductionAmount?: number;

  @ApiProperty({ description: 'Payment total amount (= taxable + gst - tds)' })
  @IsNumber()
  @Min(0)
  paymentTotalAmount: number;

  @ApiPropertyOptional({ description: 'Reason if payment is on hold' })
  @IsString()
  @IsOptional()
  paymentHoldReason?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
