import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBankTransferDto {
  @ApiPropertyOptional({ description: 'UTR number' })
  @IsString()
  @IsOptional()
  utrNumber?: string;

  @ApiPropertyOptional({ description: 'Transfer date' })
  @IsDateString()
  @IsOptional()
  transferDate?: string;

  @ApiPropertyOptional({ description: 'Transfer amount (only editable for SALE side)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  transferAmount?: number;

  @ApiPropertyOptional({
    description: 'TDS deducted by contractor (SALE side only) — syncs TDS register entry',
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

  @ApiPropertyOptional({ description: 'Proof file S3 key' })
  @IsString()
  @IsOptional()
  proofFileKey?: string;

  @ApiPropertyOptional({ description: 'Proof file name' })
  @IsString()
  @IsOptional()
  proofFileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
