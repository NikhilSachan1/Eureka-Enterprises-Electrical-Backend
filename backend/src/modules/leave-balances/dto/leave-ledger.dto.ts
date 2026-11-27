import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

const FINANCIAL_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const FINANCIAL_YEAR_MESSAGE = 'financialYear must look like 2026-2027';

export class GetMyLeaveLedgerDto extends BaseGetDto {
  @ApiProperty({ example: '2026-2027', required: false, description: 'Default: current FY' })
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
