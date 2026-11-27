import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const FINANCIAL_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const FINANCIAL_YEAR_MESSAGE = 'financialYear must look like 2026-2027';

export class GetMyLeaveLedgerDto {
  @ApiProperty({ example: '2026-2027', required: false })
  @IsOptional()
  @Matches(FINANCIAL_YEAR_PATTERN, { message: FINANCIAL_YEAR_MESSAGE })
  financialYear?: string;

  @ApiProperty({ example: 'earned', required: false })
  @IsOptional()
  @IsString()
  leaveCategory?: string;
}

export class GetLeaveLedgerDto extends GetMyLeaveLedgerDto {
  @ApiProperty({ description: 'Employee whose ledger to show' })
  @IsUUID('4')
  userId: string;
}

export class GetLeaveRecalculationDto {
  @ApiProperty({ example: '2026-2027', required: false })
  @IsOptional()
  @Matches(FINANCIAL_YEAR_PATTERN, { message: FINANCIAL_YEAR_MESSAGE })
  financialYear?: string;
}

export class ApplyLeaveRecalculationDto {
  @ApiProperty({ example: '2026-2027' })
  @IsNotEmpty()
  @Matches(FINANCIAL_YEAR_PATTERN, { message: FINANCIAL_YEAR_MESSAGE })
  financialYear: string;

  @ApiProperty({
    description: 'Only these employees (default: every employee in the report)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  userIds?: string[];
}
