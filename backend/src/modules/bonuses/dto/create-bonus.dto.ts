import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BonusType } from '../constants/bonus.constants';

export class CreateBonusDto {
  @ApiProperty({ description: 'User ID', required: true })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Bonus type', enum: BonusType, example: BonusType.DIWALI })
  @IsEnum(BonusType)
  @IsNotEmpty()
  bonusType: BonusType;

  @ApiProperty({ description: 'Bonus amount', example: 5000 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: 'Applicable month (1-12)', example: 11 })
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  applicableMonth: number;

  @ApiProperty({ description: 'Applicable year', example: 2024 })
  @IsNumber()
  @Min(2020)
  @Type(() => Number)
  applicableYear: number;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
