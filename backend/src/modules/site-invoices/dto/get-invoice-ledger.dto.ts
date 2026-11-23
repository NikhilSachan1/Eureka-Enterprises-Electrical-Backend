import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  FinancialApprovalStatus,
  PartyType,
} from 'src/modules/common/financials/financial.constants';
import {
  LEDGER_PAYMENT_STATUSES,
  LEDGER_QUARTERS,
  LedgerPaymentStatus,
  LedgerQuarter,
} from '../constants/invoice-ledger.constants';

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value : [value as string];
}

/**
 * Invoice ledger filters. One side at a time: SALE is the contractor ledger, PURCHASE the vendor
 * ledger. Rejected invoices are left out unless `approvalStatus` asks for them.
 */
export class GetInvoiceLedgerDto extends BaseGetDto {
  @ApiProperty({
    enum: PartyType,
    description: 'SALE = contractor ledger, PURCHASE = vendor ledger',
  })
  @IsEnum(PartyType)
  partyType: PartyType;

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more company IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  companyId?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more site (project) IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteId?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more contractor IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contractorId?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by one or more vendor IDs' })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vendorId?: string[];

  @ApiPropertyOptional({ enum: FinancialApprovalStatus, isArray: true })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsEnum(FinancialApprovalStatus, { each: true })
  approvalStatus?: FinancialApprovalStatus[];

  @ApiPropertyOptional({ description: 'Indian financial year, e.g. 2023-24' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'financialYear must look like 2023-24' })
  financialYear?: string;

  @ApiPropertyOptional({
    enum: LEDGER_QUARTERS,
    isArray: true,
    description: 'Q1 = Apr–Jun … Q4 = Jan–Mar',
  })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsIn(LEDGER_QUARTERS, { each: true })
  quarter?: LedgerQuarter[];

  @ApiPropertyOptional({ enum: LEDGER_PAYMENT_STATUSES, isArray: true })
  @Transform(({ value }) => toArray(value))
  @IsOptional()
  @IsArray()
  @IsIn(LEDGER_PAYMENT_STATUSES, { each: true })
  paymentStatus?: LedgerPaymentStatus[];

  @ApiPropertyOptional({ description: 'Invoice date from (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Invoice date to (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Invoice, PO or JMC number (partial, case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;
}
