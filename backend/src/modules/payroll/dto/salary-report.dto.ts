import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollStatus } from '../constants/payroll.constants';

export class GetSalaryReportDto {
  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Filter by year', required: true })
  @IsNumber()
  @Type(() => Number)
  year: number;

  @ApiProperty({ description: 'Start month (1-12)', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  startMonth?: number;

  @ApiProperty({ description: 'End month (1-12)', required: false, default: 12 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  endMonth?: number;

  @ApiProperty({ description: 'Filter by status', enum: PayrollStatus, required: false })
  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;
}
