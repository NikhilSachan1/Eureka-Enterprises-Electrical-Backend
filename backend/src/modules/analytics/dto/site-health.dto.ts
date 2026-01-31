import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for site health score request
 * Returns calculated health score based on multiple factors
 */
export class GetSiteHealthDto {
  @ApiPropertyOptional({
    description: 'Include historical trend data showing score changes over time',
    example: true,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeTrend?: boolean;

  @ApiPropertyOptional({
    description: 'Number of days to include in trend data (only used if includeTrend is true)',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  trendDays?: number;
}
