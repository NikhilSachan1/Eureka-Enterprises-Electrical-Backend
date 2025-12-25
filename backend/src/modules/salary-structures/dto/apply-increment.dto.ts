import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncrementType } from '../entities/salary-structure.entity';

export class ApplyIncrementDto {
  @ApiProperty({ description: 'User ID', required: true })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Increment percentage', example: 10 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  incrementPercentage: number;

  @ApiProperty({
    description: 'Increment type',
    enum: IncrementType,
    example: IncrementType.ANNUAL,
  })
  @IsEnum(IncrementType)
  @IsNotEmpty()
  incrementType: IncrementType;

  @ApiProperty({ description: 'Effective from date (YYYY-MM-DD)', example: '2024-04-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;

  // Optional: Override calculated values
  @ApiProperty({ description: 'Override basic (optional)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basicOverride?: number;

  @ApiProperty({ description: 'Override HRA (optional)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hraOverride?: number;

  // Can add more overrides as needed
}
