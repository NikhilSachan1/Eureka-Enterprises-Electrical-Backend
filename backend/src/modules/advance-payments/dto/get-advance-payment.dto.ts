import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * A query string carries `?siteId=<id>` as a bare string and `?siteId=<a>&siteId=<b>` as an array,
 * so a single-value filter would otherwise fail validation with "siteId must be an array". Same
 * helper the invoice, JMC and book-payment list DTOs use.
 */
function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value as string];
}

export class GetAdvancePaymentDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by one or more sites', type: [String] })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteId?: string[];

  @ApiPropertyOptional({ description: 'Filter by one or more vendors', type: [String] })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vendorId?: string[];

  @ApiPropertyOptional({ description: 'Filter by PO' })
  @IsOptional()
  @IsUUID()
  poId?: string;

  @ApiPropertyOptional({ description: 'Search by PO number (partial, case-insensitive)' })
  @IsOptional()
  @IsString()
  poNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by approval status',
    enum: FinancialApprovalStatus,
    isArray: true,
  })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsEnum(FinancialApprovalStatus, { each: true })
  approvalStatus?: FinancialApprovalStatus[];

  @ApiPropertyOptional({ description: 'Advance date from (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Advance date to (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search advance number / vendor advance number / remarks' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Only advances that still have an unsettled balance' })
  @IsOptional()
  @IsString()
  unsettledOnly?: string;
}
