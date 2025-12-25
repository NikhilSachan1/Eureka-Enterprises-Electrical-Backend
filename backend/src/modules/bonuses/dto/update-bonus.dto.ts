import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BonusType, BonusStatus } from '../constants/bonus.constants';

export class UpdateBonusDto {
  @ApiProperty({ description: 'Bonus type', enum: BonusType, required: false })
  @IsOptional()
  @IsEnum(BonusType)
  bonusType?: BonusType;

  @ApiProperty({ description: 'Bonus amount', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount?: number;

  @ApiProperty({ description: 'Applicable month (1-12)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  applicableMonth?: number;

  @ApiProperty({ description: 'Applicable year', required: false })
  @IsOptional()
  @IsNumber()
  @Min(2020)
  @Type(() => Number)
  applicableYear?: number;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Status', enum: BonusStatus, required: false })
  @IsOptional()
  @IsEnum(BonusStatus)
  status?: BonusStatus;
}
