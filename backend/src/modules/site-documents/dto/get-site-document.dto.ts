import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

/**
 * Get Site Document DTO - Repurposed for non-financial documents only.
 * 
 * Financial filters (direction, paymentStatus, dueDate, overdueOnly) have been removed.
 * 
 * For financial documents, use dedicated modules:
 * - purchase-orders, site-invoices, bank-transfers, etc.
 */
export class GetSiteDocumentDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Search by document number' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by contractor ID' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Filter by document type' })
  @IsString()
  @IsOptional()
  documentType?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by document date from' })
  @IsDateString()
  @IsOptional()
  documentDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by document date to' })
  @IsDateString()
  @IsOptional()
  documentDateTo?: string;

  @ApiPropertyOptional({ description: 'Include site details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSite?: boolean;

  @ApiPropertyOptional({ description: 'Include contractor details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeContractor?: boolean;

  @ApiPropertyOptional({ description: 'Include vendor details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeVendor?: boolean;
}
