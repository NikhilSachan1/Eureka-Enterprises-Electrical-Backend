import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { BonusType, BonusStatus } from '../constants/bonus.constants';

export class GetBonusDto extends BaseGetDto {
  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Filter by bonus type', enum: BonusType, required: false })
  @IsOptional()
  @IsEnum(BonusType)
  bonusType?: BonusType;

  @ApiProperty({ description: 'Filter by status', enum: BonusStatus, required: false })
  @IsOptional()
  @IsEnum(BonusStatus)
  status?: BonusStatus;

  @ApiProperty({ description: 'Filter by month', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  applicableMonth?: number;

  @ApiProperty({ description: 'Filter by year', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  applicableYear?: number;
}
