import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PayrollStatus } from '../constants/payroll.constants';

export class BulkCancelPayrollDto {
  @ApiProperty({
    description: 'Array of payroll IDs to cancel',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  payrollIds: string[];

  @ApiProperty({
    description: 'Reason for cancellation',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkUpdatePayrollStatusDto {
  @ApiProperty({
    description: 'Array of payroll IDs to update',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  payrollIds: string[];

  @ApiProperty({
    description: 'Target status (CANCELLED not allowed - use bulk cancel endpoint)',
    enum: [
      PayrollStatus.DRAFT,
      PayrollStatus.GENERATED,
      PayrollStatus.APPROVED,
      PayrollStatus.PAID,
    ],
    example: PayrollStatus.APPROVED,
  })
  @IsEnum(PayrollStatus)
  targetStatus: PayrollStatus;
}
