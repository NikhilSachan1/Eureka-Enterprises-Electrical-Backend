import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

/** Filters for the per-project DSR summary (how well each project reports). */
export class GetDsrProjectSummaryDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Only this project' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Period start (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({ description: 'Period end (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @ApiPropertyOptional({ description: 'Project name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Only this person’s allocations and reports. Forced to the caller for roles that may only see their own DSRs.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
