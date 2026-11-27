import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentTypeFilter } from '../constants/book-payment.constants';

/**
 * Book Payment dropdown for a PURCHASE bank transfer. Either an invoice (its invoice bookings, the
 * original behaviour), or a project + payment type — advance bookings have no invoice and GST
 * releases sit outside it, so they are picked by project instead.
 */
export class BookPaymentDropdownQueryDto {
  @ApiPropertyOptional({ description: 'Invoice ID — lists that invoice’s book payments' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Project (site) ID — used with paymentType' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({
    enum: PaymentTypeFilter,
    description: 'INVOICE | ADVANCE | GST (held GST release). With siteId.',
  })
  @IsOptional()
  @IsEnum(PaymentTypeFilter)
  paymentType?: PaymentTypeFilter;
}
