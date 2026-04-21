import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { PermissionPlatform } from '../constants/permission.constants';

export class GetPermissionDto extends BaseGetDto {
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
