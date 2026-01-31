import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseAnalyticsDto } from './base-analytics.dto';

/**
 * DTO for site profitability analytics request
 * Returns revenue, expenses, and profit analysis for sites
 */
export class GetSiteProfitabilityDto extends BaseAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Filter by site status (UPCOMING, ONGOING, COMPLETED, HOLD)',
    example: 'ONGOING',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by contractor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @ApiPropertyOptional({
    description:
      'Sort by field (name, createdAt, totalRevenue, totalExpenses, profit, profitMargin)',
    example: 'profitMargin',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'DESC',
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
