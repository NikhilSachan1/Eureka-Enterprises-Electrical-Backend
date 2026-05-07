import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class GetPoSummaryDto {
  @ApiProperty({ description: 'Purchase Order ID' })
  @IsUUID()
  poId: string;
}

export class GetSiteSummaryDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  siteId: string;

  @ApiPropertyOptional({ description: 'Filter by party type (SALE or PURCHASE)' })
  @IsString()
  @IsOptional()
  partyType?: string;
}

export class GetSiteClosingReadinessDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  siteId: string;
}
