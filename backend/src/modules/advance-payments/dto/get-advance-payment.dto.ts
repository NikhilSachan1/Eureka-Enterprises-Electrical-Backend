import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

export class GetAdvancePaymentDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by site', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteId?: string[];

  @ApiPropertyOptional({ description: 'Filter by vendor', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vendorId?: string[];

  @ApiPropertyOptional({ description: 'Filter by PO' })
  @IsOptional()
  @IsUUID()
  poId?: string;

  @ApiPropertyOptional({
    description: 'Filter by approval status',
    enum: FinancialApprovalStatus,
    isArray: true,
  })
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
