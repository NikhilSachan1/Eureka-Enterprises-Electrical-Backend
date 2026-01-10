import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { DashboardPeriod } from '../constants/dashboard.constants';

export class GetDashboardDto {
  @ApiProperty({
    description: 'Single section to fetch',
    example: 'overview',
    required: false,
  })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiProperty({
    description: 'Multiple sections to fetch (comma-separated)',
    example: 'overview,birthdays,alerts',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.split(',').map((s: string) => s.trim()))
  sections?: string[];

  @ApiProperty({
    description: 'Time period for data',
    enum: DashboardPeriod,
    example: 'month',
    required: false,
  })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;

  @ApiProperty({
    description: 'Start date for custom period',
    example: '2026-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for custom period',
    example: '2026-01-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
