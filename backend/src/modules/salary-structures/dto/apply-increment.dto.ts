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
import { IncrementType } from '../constants/salary-structure.constants';

export class ApplyIncrementDto {
  @ApiProperty({ description: 'User ID', required: true })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

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

  // ==================== Earnings (All Required) ====================
  @ApiProperty({ description: 'New Basic salary', example: 27500, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basic: number;

  @ApiProperty({ description: 'New House Rent Allowance', example: 11000, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hra: number;

  @ApiProperty({ description: 'New Food Allowance', example: 2200, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  foodAllowance: number;

  @ApiProperty({ description: 'New Conveyance Allowance', example: 1760, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  conveyanceAllowance: number;

  @ApiProperty({ description: 'New Medical Allowance', example: 1375, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  medicalAllowance: number;

  @ApiProperty({ description: 'New Special Allowance', example: 5500, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  specialAllowance: number;

  // ==================== Deductions (All Required) ====================
  @ApiProperty({ description: 'Employee PF contribution', example: 3300, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  employeePf: number;

  @ApiProperty({ description: 'Employer PF contribution', example: 3300, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  employerPf: number;

  @ApiProperty({ description: 'Tax Deducted at Source', example: 2200, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tds: number;

  @ApiProperty({ description: 'ESIC (applicable if gross <= limit)', example: 0, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  esic: number;

  @ApiProperty({ description: 'Professional Tax', example: 200, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  professionalTax: number;

  // ==================== Optional Fields ====================
  @ApiProperty({
    description: 'Increment percentage (for record-keeping only, not used in calculation)',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  incrementPercentage?: number;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
