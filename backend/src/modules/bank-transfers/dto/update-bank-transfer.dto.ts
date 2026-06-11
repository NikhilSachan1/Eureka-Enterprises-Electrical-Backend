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
