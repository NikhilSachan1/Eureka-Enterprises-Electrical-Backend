import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { UserPermissionStatsSortFields } from '../constants/user-permission.constants';

export class GetUserPermissionStatsDto extends BaseGetDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId: string;

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
