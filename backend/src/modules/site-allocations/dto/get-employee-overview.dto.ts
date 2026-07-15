import { IsOptional, IsString, IsUUID, IsIn, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

/**
 * Note: pagination is OPTIONAL with NO default — if `pageSize` is omitted, ALL records are
 * returned (no LIMIT). Send `page` + `pageSize` to paginate.
 */
export class GetEmployeeOverviewDto {
  @ApiPropertyOptional({ description: 'Filter by allocation status', enum: ['FREE', 'ALLOCATED'] })
  @IsOptional()
  @IsIn(['FREE', 'ALLOCATED'])
  allocatedStatus?: 'FREE' | 'ALLOCATED';

  @ApiPropertyOptional({ description: 'Search by employee name or code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by current project/site id' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by current project/site name' })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({ description: 'Page number (omit with pageSize to get ALL records)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size — OMIT to return ALL records (no pagination)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Sort order', enum: SortOrder })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: string;
}
