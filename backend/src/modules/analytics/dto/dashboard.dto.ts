import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { BaseAnalyticsDto } from './base-analytics.dto';

/**
 * DTO for executive dashboard request
 * Returns high-level summary of sites, financials, and alerts
 */
export class GetExecutiveDashboardDto extends BaseAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Filter by company ID to see dashboard for specific company',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
