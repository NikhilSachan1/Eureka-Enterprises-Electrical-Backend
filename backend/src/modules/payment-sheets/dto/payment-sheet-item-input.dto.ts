import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { BeneficiaryType, PaymentSourceType } from '../constants/payment-sheet.constants';

/**
 * One beneficiary line the initiator/admin adds to a sheet.
 * For USER items, set `userId` + `sourceType` (EXPENSE | FUEL_EXPENSE).
 * For VENDOR items, set `vendorId` + `sourceType` = VENDOR_PAYMENT + `bookPaymentIds`.
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

  @ApiProperty({ description: 'Amount to pay this beneficiary (≤ live pending)', example: 1000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  requestedAmount: number;

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
