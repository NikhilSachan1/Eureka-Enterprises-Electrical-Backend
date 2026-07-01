import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import { PaymentSheetStatus } from '../constants/payment-sheet.constants';

export class QueryPaymentSheetDto {
  @ApiPropertyOptional({ example: 1 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @Transform(({ value }) => (value !== undefined ? parseInt(value) : undefined))
  @IsNumber()
  @Min(1)
  @Max(1000)
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: string = SortOrder.DESC;

  @ApiPropertyOptional({ enum: PaymentSheetStatus })
  @IsOptional()
  @IsEnum(PaymentSheetStatus)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by current stage key' })
  @IsOptional()
  @IsString()
  currentStage?: string;

  @ApiPropertyOptional({ description: 'Financial year, e.g. 2526' })
  @IsOptional()
  @IsString()
  financialYear?: string;

  @ApiPropertyOptional({ description: 'Search by sheet number or title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Only sheets with at least one item paid from this company bank account',
  })
  @IsOptional()
  @IsUUID()
  paidFromAccountId?: string;

  @ApiPropertyOptional({
    description:
      'Only sheets with at least one item paid from an account matching this name (partial match)',
  })
  @IsOptional()
  @IsString()
  paidFromAccountName?: string;

  @ApiPropertyOptional({
    description:
      'true = only sheets with at least one item that has a paying account linked; ' +
      'false = only sheets with at least one item that has none',
  })
  @IsOptional()
  @Transform(({ value, key, obj }) => {
    const raw = obj?.[key] ?? value;
    if (raw === false || raw === 'false') return false;
    if (raw === true || raw === 'true') return true;
    return undefined;
  })
  @IsBoolean()
  hasPaidFromAccount?: boolean;
}
