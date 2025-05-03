import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';
import { UserSortFields, UserStatus, USER_DTO_ERRORS } from '../constants/user.constants';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { Transform } from 'class-transformer';

export class GetUsersDto extends BaseGetDto {
  @ApiProperty({ description: 'First name to be searched by', example: 'John', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Last name to be searched by',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'Email to be searched by',
    example: 'test@test.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Status to be searched by - can be a single status or multiple statuses',
    enum: UserStatus,
    example: ['ACTIVE', 'INVITED'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserStatus, {
    each: true,
    message: `${USER_DTO_ERRORS.INVALID_STATUS} ${Object.values(UserStatus).join(', ')}`,
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((status) => status.trim());
      }
    }
    return [value];
  })
  status?: string[];

  @ApiProperty({
    description: 'Column to be sorted by',
    example: 'createdAt',
    enum: UserSortFields,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(UserSortFields, {
    message: `${USER_DTO_ERRORS.INVALID_SORT_FIELD} ${Object.values(UserSortFields).join(', ')}`,
  })
  sortField?: string = UserSortFields.CREATED_AT;

  @ApiProperty({
    description: 'Free search text to search in firstName, lastName and email fields',
    example: 'john',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Role to be searched by',
    example: 'ADMIN',
    enum: Roles,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(Roles, { message: `${USER_DTO_ERRORS.INVALID_ROLE} ${Object.values(Roles).join(', ')}` })
  role?: string;
}
