import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { PartyType } from 'src/modules/common/financials/financial.constants';

export class CreateBankTransferDto {
  @ApiProperty({ enum: PartyType, description: 'SALE or PURCHASE' })
  @IsEnum(PartyType)
  partyType: PartyType;

  @ApiPropertyOptional({ description: 'Invoice ID (required for SALE side)' })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Book Payment ID (required for PURCHASE side)' })
  @IsUUID()
  @IsOptional()
  bookPaymentId?: string;

  @ApiProperty({ description: 'UTR number' })
  @IsString()
  utrNumber: string;

  @ApiProperty({ description: 'Transfer date' })
  @IsDateString()
  transferDate: string;

  @ApiProperty({ description: 'Transfer amount' })
  @IsNumber()
  @Min(0)
  transferAmount: number;

  @ApiPropertyOptional({ description: 'Proof file S3 key' })
  @IsString()
  @IsOptional()
  proofFileKey?: string;

  @ApiPropertyOptional({ description: 'Proof file name' })
  @IsString()
  @IsOptional()
  proofFileName?: string;

  @ApiPropertyOptional({
    description: 'TDS deducted by contractor (SALE side only) — auto-creates TDS register entry',
    example: 200,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  tdsDeducted?: number;

  @ApiPropertyOptional({
    description: 'TDS percentage (informational, SALE side only)',
    example: 2,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  tdsPercentage?: number;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
