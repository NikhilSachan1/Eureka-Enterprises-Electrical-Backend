import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class ServiceAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by vehicle ID (optional, for single vehicle analytics)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  vehicleMasterId?: string;

  @ApiPropertyOptional({
    description: 'Start date for analytics period',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics period',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
