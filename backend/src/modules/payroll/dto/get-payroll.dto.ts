import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { PayrollStatus } from '../entities/payroll.entity';

export class GetPayrollDto extends BaseGetDto {
  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Filter by month', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @ApiProperty({ description: 'Filter by year', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;

  @ApiProperty({ description: 'Filter by status', enum: PayrollStatus, required: false })
  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;
}
