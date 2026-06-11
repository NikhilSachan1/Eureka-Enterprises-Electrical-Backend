import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookPaymentDto {
  @ApiProperty({ description: 'Invoice ID (must be PURCHASE side, APPROVED)' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ description: 'Booking date' })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({
    description:
      'Amount being paid now. Multiple book payments allowed until invoice is fully booked.',
    example: 800,
  })
  @IsNumber()
  @Min(1)
  transferAmount: number;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
