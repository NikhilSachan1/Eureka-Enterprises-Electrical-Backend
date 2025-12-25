import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryStructureDto {
  @ApiProperty({ description: 'User ID', required: true })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  // ==================== Earnings ====================
  @ApiProperty({ description: 'Basic salary', example: 25000, required: true })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basic: number;

  @ApiProperty({ description: 'House Rent Allowance', example: 10000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hra?: number = 0;

  @ApiProperty({ description: 'Food Allowance', example: 2000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  foodAllowance?: number = 0;

  @ApiProperty({ description: 'Conveyance Allowance', example: 1600, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  conveyanceAllowance?: number = 0;

  @ApiProperty({ description: 'Medical Allowance', example: 1250, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  medicalAllowance?: number = 0;

  @ApiProperty({ description: 'Special Allowance', example: 5000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  specialAllowance?: number = 0;

  // ==================== Deductions ====================
  @ApiProperty({ description: 'Employee PF contribution', example: 3000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  employeePf?: number = 0;

  @ApiProperty({ description: 'Employer PF contribution', example: 3000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  employerPf?: number = 0;

  @ApiProperty({ description: 'Tax Deducted at Source', example: 2000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tds?: number = 0;

  @ApiProperty({ description: 'ESIC (applicable if gross <= 21000)', example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  esic?: number = 0;

  @ApiProperty({ description: 'Professional Tax', example: 200, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  professionalTax?: number = 0;

  // ==================== Effective Date ====================
  @ApiProperty({ description: 'Effective from date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
