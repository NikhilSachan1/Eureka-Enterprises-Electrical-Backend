import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSalaryStructureDto {
  // ==================== Earnings ====================
  @ApiProperty({ description: 'Basic salary', example: 25000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basic?: number;

  @ApiProperty({ description: 'House Rent Allowance', example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hra?: number;

  @ApiProperty({ description: 'Food Allowance', example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  foodAllowance?: number;

  @ApiProperty({ description: 'Conveyance Allowance', example: 1600 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  conveyanceAllowance?: number;

  @ApiProperty({ description: 'Medical Allowance', example: 1250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  medicalAllowance?: number;

  @ApiProperty({ description: 'Special Allowance', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  specialAllowance?: number;

  // ==================== Deductions ====================
  @ApiProperty({ description: 'Employee PF contribution', example: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  employeePf?: number;

  @ApiProperty({ description: 'Employer PF contribution', example: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  employerPf?: number;

  @ApiProperty({ description: 'Tax Deducted at Source', example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tds?: number;

  @ApiProperty({ description: 'ESIC (applicable if gross <= 21000)', example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  esic?: number;

  @ApiProperty({ description: 'Professional Tax', example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  professionalTax?: number;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ description: 'Reason for update', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
