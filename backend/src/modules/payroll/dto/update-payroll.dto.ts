import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollStatus } from '../constants/payroll.constants';

export class UpdatePayrollDto {
  // Status update
  @ApiProperty({
    description: 'Payroll status',
    enum: PayrollStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  // Attendance adjustments
  @ApiProperty({ description: 'Present days', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  presentDays?: number;

  @ApiProperty({ description: 'Absent days', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  absentDays?: number;

  @ApiProperty({ description: 'Paid leave days', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paidLeaveDays?: number;

  @ApiProperty({ description: 'Unpaid leave days (LOP)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unpaidLeaveDays?: number;

  // Manual adjustments
  @ApiProperty({ description: 'Additional deduction', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  additionalDeduction?: number;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
