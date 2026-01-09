import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  TriggerableCronJob,
  JOBS_REQUIRING_DATE,
  JOBS_REQUIRING_MONTH_YEAR,
  JOBS_REQUIRING_YEAR,
} from '../constants/cron-trigger.constants';

export class TriggerCronDto {
  @ApiProperty({
    description: 'The cron job to trigger',
    enum: TriggerableCronJob,
    example: TriggerableCronJob.MONTHLY_PAYROLL_GENERATION,
  })
  @IsEnum(TriggerableCronJob)
  jobName: TriggerableCronJob;

  @ApiPropertyOptional({
    description: 'Target date for date-based jobs (YYYY-MM-DD)',
    example: '2025-01-09',
  })
  @ValidateIf((o) => JOBS_REQUIRING_DATE.includes(o.jobName))
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Target month (1-12) for monthly jobs',
    example: 12,
    minimum: 1,
    maximum: 12,
  })
  @ValidateIf((o) => JOBS_REQUIRING_MONTH_YEAR.includes(o.jobName))
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    description: 'Target year for monthly/yearly jobs',
    example: 2025,
  })
  @ValidateIf((o) => [...JOBS_REQUIRING_MONTH_YEAR, ...JOBS_REQUIRING_YEAR].includes(o.jobName))
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description: 'Specific user ID to process (optional, processes all if not provided)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'If true, simulates the job without making changes',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: 'Skip dependency validation (use with caution)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipDependencyCheck?: boolean;

  @ApiPropertyOptional({
    description: 'Force run even if already processed for the period',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRun?: boolean;
}

export class TriggerCronResponseDto {
  @ApiProperty({ description: 'Job execution status' })
  success: boolean;

  @ApiProperty({ description: 'Status message' })
  message: string;

  @ApiProperty({ description: 'Job name that was triggered' })
  jobName: string;

  @ApiPropertyOptional({ description: 'Execution details' })
  details?: {
    recordsProcessed?: number;
    recordsSkipped?: number;
    recordsFailed?: number;
    errors?: string[];
    duration?: number;
  };

  @ApiPropertyOptional({ description: 'Parameters used for execution' })
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Was this a dry run?' })
  dryRun?: boolean;
}

export class ListCronJobsResponseDto {
  @ApiProperty({ description: 'List of available cron jobs' })
  jobs: {
    name: string;
    description: string;
    requiredParameters: string[];
    dependencies: string[];
  }[];
}
