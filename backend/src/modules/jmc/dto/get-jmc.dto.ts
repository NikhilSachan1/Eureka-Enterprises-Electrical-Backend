import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  PartyType,
  FinancialApprovalStatus,
} from 'src/modules/common/financials/financial.constants';

export class GetJmcDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by parent PO' })
  @IsUUID('4')
  @IsOptional()
  poId?: string;

  @ApiPropertyOptional({ description: 'Filter by site' })
  @IsUUID('4')
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by party type', enum: PartyType })
  @IsEnum(PartyType)
  @IsOptional()
  partyType?: PartyType;

  @ApiPropertyOptional({ description: 'Filter by approval status', enum: FinancialApprovalStatus })
  @IsEnum(FinancialApprovalStatus)
  @IsOptional()
  approvalStatus?: FinancialApprovalStatus;

  @ApiPropertyOptional({ description: 'Search JMC number' })
  @IsString()
  @IsOptional()
  search?: string;
}
