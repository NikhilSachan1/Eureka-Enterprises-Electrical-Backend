import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class UpdateFnfDto {
  @ApiPropertyOptional({
    description: 'Other deductions amount',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherDeductions?: number;

  @ApiPropertyOptional({
    description: 'Deduction remarks',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deductionRemarks?: string;

  @ApiPropertyOptional({
    description: 'Pending reimbursements amount',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pendingReimbursements?: number;

  @ApiPropertyOptional({
    description: 'Other additions amount',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherAdditions?: number;

  @ApiPropertyOptional({
    description: 'Addition remarks',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionRemarks?: string;

  @ApiPropertyOptional({
    description: 'General remarks',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
