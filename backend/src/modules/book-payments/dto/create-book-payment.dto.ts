import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { BookPaymentSourceType } from '../constants/book-payment.constants';

export class CreateBookPaymentDto {
  /**
   * Which document the payment is raised against. Defaults to INVOICE so every existing caller
   * keeps working unchanged — they simply never send this field.
   */
  @ApiPropertyOptional({
    description: 'What this payment is raised against. Defaults to INVOICE.',
    enum: BookPaymentSourceType,
  })
  @IsEnum(BookPaymentSourceType)
  @IsOptional()
  sourceType?: BookPaymentSourceType;

  @ApiPropertyOptional({
    description:
      'Invoice ID (must be PURCHASE side, APPROVED). Required unless sourceType=ADVANCE.',
  })
  @ValidateIf((o) => o.sourceType !== BookPaymentSourceType.ADVANCE)
  @IsUUID()
  invoiceId: string;

  @ApiPropertyOptional({
    description: 'Advance payment ID (must be APPROVED). Required when sourceType=ADVANCE.',
  })
  @ValidateIf((o) => o.sourceType === BookPaymentSourceType.ADVANCE)
  @IsUUID()
  advancePaymentId?: string;

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
