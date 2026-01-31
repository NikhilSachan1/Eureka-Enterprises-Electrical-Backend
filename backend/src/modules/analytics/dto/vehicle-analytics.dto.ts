import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseAnalyticsDto } from './base-analytics.dto';

/**
 * DTO for vehicle/fleet analytics request
 * Returns usage metrics and anomaly tracking for vehicles
 */
export class GetVehicleAnalyticsDto extends BaseAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Search by registration number',
    example: 'MH-12-AB-1234',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by vehicle status (AVAILABLE, ASSIGNED, MAINTENANCE)',
    example: 'AVAILABLE',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned employee ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'Sort by field (registrationNo, totalKmThisMonth, anomalyCount, lastLogDate)',
    example: 'totalKmThisMonth',
    default: 'registrationNo',
  })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'DESC',
    default: 'ASC',
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
