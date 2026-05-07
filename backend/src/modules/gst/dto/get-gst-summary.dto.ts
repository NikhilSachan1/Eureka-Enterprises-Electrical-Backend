import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

export class GetGstSummaryDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  siteId: string;

  @ApiPropertyOptional({ description: 'Financial year (e.g., "2526")' })
  @IsString()
  @IsOptional()
  financialYear?: string;
}
