import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsEnum } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { PartyType } from 'src/modules/common/financials/financial.constants';

export class GetSiteReportDto extends BaseGetDto {
  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  jmcId?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ enum: PartyType })
  @IsEnum(PartyType)
  @IsOptional()
  partyType?: PartyType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}
