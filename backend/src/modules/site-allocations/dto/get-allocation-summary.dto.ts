import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

/** Filters for the per-employee and per-project allocation summaries. */
export class GetAllocationSummaryDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Only allocations on this site' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({
    description: 'Period start (YYYY-MM-DD): only allocations active on any day from this date',
  })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({
    description: 'Period end (YYYY-MM-DD): only allocations active on any day up to this date',
  })
  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @ApiPropertyOptional({
    description: 'Employee name or code (employee summary), or project name (project summary)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
