import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
  IsUUID,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { WalletTransactionType } from '../constants/petro-card-wallet.constants';

export class CreateWalletRechargeDto {
  @ApiProperty({ description: 'Amount added to the wallet. Must be greater than zero.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'When the money actually went in (ISO)' })
  @IsDateString()
  rechargeDate: string;

  @ApiPropertyOptional({ description: 'UTR / cheque number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'How the recharge itself was paid' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentMode?: string;

  @ApiPropertyOptional({ description: "Which of the org's own bank accounts funded it" })
  @IsOptional()
  @IsUUID('4')
  paidFromAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

/** Every field optional — a correction usually touches one of them. */
export class UpdateWalletRechargeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  rechargeDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  paidFromAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Inclusive lower bound on the transaction date (ISO)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound on the transaction date (ISO)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class GetWalletRechargesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Matches reference number or remarks' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class GetWalletTransactionsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: WalletTransactionType,
    description: 'Show only recharges or only fuel deductions. Omit for both.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(WalletTransactionType)
  type?: WalletTransactionType;
}
