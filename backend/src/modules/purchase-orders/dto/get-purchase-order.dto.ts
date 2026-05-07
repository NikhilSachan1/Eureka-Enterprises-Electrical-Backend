import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  PartyType,
  FinancialApprovalStatus,
} from 'src/modules/common/financials/financial.constants';

export class GetPurchaseOrderDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsUUID('4')
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by party type', enum: PartyType })
  @IsEnum(PartyType)
  @IsOptional()
  partyType?: PartyType;

  @ApiPropertyOptional({ description: 'Filter by contractor ID' })
  @IsUUID('4')
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsUUID('4')
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by approval status',
    enum: FinancialApprovalStatus,
  })
  @IsEnum(FinancialApprovalStatus)
  @IsOptional()
  approvalStatus?: FinancialApprovalStatus;

  @ApiPropertyOptional({ description: 'Search PO number' })
  @IsString()
  @IsOptional()
  search?: string;
}
