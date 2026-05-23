import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetDsrDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({
    description: 'Filter by one or more user IDs',
    example: ['uuid1', 'uuid2'],
    isArray: true,
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userId?: string[];

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by weather condition' })
  @IsString()
  @IsOptional()
  weatherCondition?: string;

  @ApiPropertyOptional({ description: 'Filter by report date from' })
  @IsDateString()
  @IsOptional()
  reportDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by report date to' })
  @IsDateString()
  @IsOptional()
  reportDateTo?: string;

  @ApiPropertyOptional({ description: 'Include site details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSite?: boolean;

  @ApiPropertyOptional({ description: 'Include user details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeUser?: boolean;

  @ApiPropertyOptional({ description: 'Include files' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeFiles?: boolean;

  @ApiPropertyOptional({ description: 'Include edit history' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeEditHistory?: boolean;
}
