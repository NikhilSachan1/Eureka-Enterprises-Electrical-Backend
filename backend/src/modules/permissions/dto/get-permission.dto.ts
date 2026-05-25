import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { PermissionPlatform } from '../constants/permission.constants';

export class GetPermissionDto extends BaseGetDto {
  // Override: no default — undefined means return all
  @ApiPropertyOptional({ description: 'Page size (omit to return all records)', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = undefined;
  @ApiPropertyOptional({
    description: 'Filter by module name',
    example: 'users',
  })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({
    description: 'Filter by platform (web or mobile)',
    example: 'web',
    enum: PermissionPlatform,
  })
  @IsOptional()
  @IsEnum(PermissionPlatform)
  platform?: PermissionPlatform;

  @ApiPropertyOptional({
    description: 'Search by label',
    example: 'Create User',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
