import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for site timeline request
 * Returns chronological list of events for a site
 */
export class GetSiteTimelineDto {
  @ApiPropertyOptional({
    description:
      'Filter by event type (SITE_CREATED, STATUS_CHANGED, CONTRACTOR_ASSIGNED, EMPLOYEE_ALLOCATED, DOCUMENT_UPLOADED)',
    example: 'STATUS_CHANGED',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Start date for timeline filter (events on or after this date)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for timeline filter (events on or before this date)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of events to return',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
