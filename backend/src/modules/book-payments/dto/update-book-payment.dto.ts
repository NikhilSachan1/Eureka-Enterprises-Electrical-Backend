import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min, IsIn } from 'class-validator';

export class UpdateBookPaymentDto {
  @ApiPropertyOptional({ description: 'Booking date' })
  @IsDateString()
  @IsOptional()
  bookingDate?: string;

  @ApiPropertyOptional({ description: 'Taxable amount (pre-GST work amount)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  taxableAmount?: number;

  @ApiPropertyOptional({ description: 'GST amount' })
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
    description: 'GST compliance hold type (1B = GSTR-1B, 3B = GSTR-3B)',
    enum: ['1B', '3B'],
  })
  @IsIn(['1B', '3B'])
  @IsOptional()
  gstHoldType?: '1B' | '3B';

  @ApiPropertyOptional({ description: 'GST amount being withheld', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  gstHoldAmount?: number;

  @ApiPropertyOptional({
    description: 'Net payment hold amount withheld for operational reasons',
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  paymentHoldAmount?: number;

  @ApiPropertyOptional({ description: 'Reason if payment is on hold' })
  @IsString()
  @IsOptional()
  paymentHoldReason?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
