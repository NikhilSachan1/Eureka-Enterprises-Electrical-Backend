import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { USER_DTO_ERRORS, UserStatus } from '../constants/user.constants';

export class UpdateUserDto {
  @ApiProperty({ description: 'First name to be updated of the user.', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'Last name to be updated of the user.', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Contact number to be updated of the user.', required: false })
  @IsOptional()
  @IsString()
  contactNumber?: string;

  @ApiProperty({ description: 'Status to be updated of the user.', required: false })
  @IsOptional()
  @IsString()
  @IsEnum(UserStatus, {
    message: `${USER_DTO_ERRORS.INVALID_STATUS} ${Object.values(UserStatus).join(', ')}`,
  })
  status?: string;
}
