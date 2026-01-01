import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { CronJobStatus, CronJobType, CronTriggerType } from '../constants/cron-log.constants';

export class CronLogQueryDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Filter by job name',
    example: 'CARD_EXPIRY_CHECK',
  })
  @IsOptional()
  @IsString()
  jobName?: string;

  @ApiPropertyOptional({
    description: 'Filter by job type',
    enum: CronJobType,
    example: CronJobType.CARD,
  })
  @IsOptional()
  @IsEnum(CronJobType)
  jobType?: CronJobType;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: CronJobStatus,
    example: CronJobStatus.SUCCESS,
  })
  @IsOptional()
  @IsEnum(CronJobStatus)
  status?: CronJobStatus;

  @ApiPropertyOptional({
    description: 'Filter by trigger type',
    enum: CronTriggerType,
    example: CronTriggerType.SYSTEM,
  })
  @IsOptional()
  @IsEnum(CronTriggerType)
  triggeredBy?: CronTriggerType;

  @ApiPropertyOptional({
    description: 'Filter by start date (from)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (to)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
