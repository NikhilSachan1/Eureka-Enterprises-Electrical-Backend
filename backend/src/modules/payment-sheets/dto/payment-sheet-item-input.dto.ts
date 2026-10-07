import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { BeneficiaryType, PaymentSourceType } from '../constants/payment-sheet.constants';

/**
 * One beneficiary line the initiator/admin adds to a sheet.
 * For USER items, set `userId` + `sourceType` (EXPENSE | FUEL_EXPENSE).
 * For VENDOR items, set `vendorId` + `sourceType` = VENDOR_PAYMENT + `bookPaymentIds`.
 * For WALLET items, set `sourceType` = PETRO_CARD_WALLET + `rechargeId` — nothing else. There is
 * no beneficiary to name and no bank details to capture, and the amount comes from the recharge
 * rather than being typed, so a line can never ask for more than was actually raised. The wallet is
 * credited when the line is paid.
 */
export class PaymentSheetItemInputDto {
  @ApiProperty({ enum: BeneficiaryType })
  @IsEnum(BeneficiaryType)
  beneficiaryType: BeneficiaryType;

  @ApiPropertyOptional({ description: 'Required when beneficiaryType = USER' })
  @ValidateIf((o) => o.beneficiaryType === BeneficiaryType.USER)
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Required when beneficiaryType = VENDOR' })
  @ValidateIf((o) => o.beneficiaryType === BeneficiaryType.VENDOR)
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ enum: PaymentSourceType })
  @IsEnum(PaymentSourceType)
  sourceType: PaymentSourceType;

  @ApiPropertyOptional({
    description:
      'The outstanding PetroCard Wallet recharge this line pays. Required when beneficiaryType = ' +
      'WALLET. Must still be outstanding — unpaid and not already on another live sheet.',
  })
  @ValidateIf((o) => o.beneficiaryType === BeneficiaryType.WALLET)
  @IsUUID()
  rechargeId?: string;

  @ApiPropertyOptional({
    description:
      'Amount to pay (≤ live pending). Required for USER items. Ignored for WALLET items, where ' +
      'it comes from the recharge. For VENDOR items it is derived from bookPaymentIds and may be ' +
      'omitted; if sent it must equal that sum.',
    example: 1000,
  })
  @ValidateIf(
    (o) =>
      o.beneficiaryType === BeneficiaryType.USER ||
      (o.beneficiaryType !== BeneficiaryType.WALLET && o.requestedAmount !== undefined),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  requestedAmount?: number;

  // No reference number or remarks here: for a wallet line those are payment details, known only
  // when the line is actually paid. They come off PayItemDto and land on the recharge record.

  @ApiPropertyOptional({
    description: 'Book payment ids backing a VENDOR item (Σ transfer amounts = requestedAmount)',
    type: [String],
  })
  @ValidateIf((o) => o.beneficiaryType === BeneficiaryType.VENDOR)
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  bookPaymentIds?: string[];
}
