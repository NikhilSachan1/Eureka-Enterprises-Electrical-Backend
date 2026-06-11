import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBookPaymentDto {
  @ApiPropertyOptional({ description: 'Booking date' })
  @IsDateString()
  @IsOptional()
  bookingDate?: string;

  @ApiPropertyOptional({ description: 'Amount being paid in this booking' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  transferAmount?: number;

  @ApiPropertyOptional({
    description: 'Reason for partial payment — shown on payment advice as hold reason',
  })
  @IsString()
  @IsOptional()
  paymentHoldReason?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
