import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AnalyticsPeriod } from '../constants/analytics.constants';

/**
 * Base DTO for analytics with common date range filters
 * Extended by other analytics DTOs that need period-based filtering
 */
export class BaseAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Time period for analytics',
    enum: AnalyticsPeriod,
    default: AnalyticsPeriod.MONTH,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    description: 'Custom start date (required when period is CUSTOM)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Custom end date (required when period is CUSTOM)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
