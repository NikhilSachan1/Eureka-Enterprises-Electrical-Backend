import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsUUID, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { UserPermissionStatsSortFields } from '../constants/user-permission.constants';

export class GetUserPermissionStatsDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'User IDs (supports multiple values)',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  userIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by role name/code (e.g., ADMIN, DRIVER)',
    example: 'ADMIN',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Search by first name, last name, or email',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Column to be sorted by',
    example: 'createdAt',
    enum: UserPermissionStatsSortFields,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(UserPermissionStatsSortFields)
  sortField?: string = UserPermissionStatsSortFields.CREATED_AT;
}
