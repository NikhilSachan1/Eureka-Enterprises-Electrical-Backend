import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  PartyType,
  FinancialApprovalStatus,
} from 'src/modules/common/financials/financial.constants';

export class GetSiteInvoiceDto extends BaseGetDto {
  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  jmcId?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  poId?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ enum: PartyType })
  @IsEnum(PartyType)
  @IsOptional()
  partyType?: PartyType;

  @ApiPropertyOptional({ enum: FinancialApprovalStatus })
  @IsEnum(FinancialApprovalStatus)
  @IsOptional()
  approvalStatus?: FinancialApprovalStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}
