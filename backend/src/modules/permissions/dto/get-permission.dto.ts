import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetPermissionDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Filter by module name',
    example: 'users',
  })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({
    description: 'Search by label',
    example: 'Create User',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
