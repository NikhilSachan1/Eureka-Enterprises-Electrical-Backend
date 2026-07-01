import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** HR/Admin edit of a single item amount (reason mandatory at admin stage). */
export class EditItemAmountDto {
  @ApiProperty({ example: 800 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Required at ADMIN_REVIEW stage' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Generic reason payload — forward (optional), return/reject/hold (required). */
export class StageActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Bulk verify — verify the listed item ids; omit `itemIds` to verify ALL lines at the stage. */
export class VerifyItemsDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Item ids to verify. Omit or empty to verify every line at the current stage.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  itemIds?: string[];
}

/** Bulk unverify — remove the current stage's verification from the listed item ids. */
export class UnverifyItemsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  itemIds: string[];
}

/** One bank transfer to create for a vendor item's book-payment allocation. */
export class VendorTransferInputDto {
  @ApiProperty()
  @IsUUID()
  bookPaymentId: string;

  @ApiProperty({ example: 'UTR123456789' })
  @IsString()
  utrNumber: string;

  @ApiProperty({ example: '2026-06-24' })
  @IsDateString()
  transferDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proofFileKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proofFileName?: string;
}

/**
 * Accountant pays an item.
 * USER (expense/fuel): supply paymentMode + paidDate (+ optional transactionId).
 * VENDOR: supply one transfer per allocated book payment.
 */
export class PayItemDto {
  @ApiPropertyOptional({ description: 'The company bank account to pay this item from' })
  @IsOptional()
  @IsUUID()
  paidFromAccountId?: string;

  // ── USER settlement fields ──
  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  paymentMode?: string;

  @ApiPropertyOptional({ description: 'Expense category (required when paying an EXPENSE item)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Settlement note written to the ledger entry' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-06-24' })
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionId?: string;

  // ── VENDOR settlement fields ──
  @ApiPropertyOptional({ type: [VendorTransferInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VendorTransferInputDto)
  transfers?: VendorTransferInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
