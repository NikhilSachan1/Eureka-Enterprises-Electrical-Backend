import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { AUTH_DTO_ERRORS } from '../../auth/constants/auth.constants';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'currentPassword123@', required: true })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'New password', example: 'newPassword123@', required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: AUTH_DTO_ERRORS.PASSWORD_LENGTH })
  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
    message: AUTH_DTO_ERRORS.PASSWORD_STRENGTH,
  })
  newPassword: string;

  @ApiProperty({ description: 'Confirm password', example: 'newPassword123@', required: true })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
