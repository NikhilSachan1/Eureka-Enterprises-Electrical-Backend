import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class GetAllRoleDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Filter by role names (supports multiple values)',
    example: ['ADMIN', 'DRIVER'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  names?: string[];

  @ApiPropertyOptional({
    description: 'Search by label',
    example: 'Administrator',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
