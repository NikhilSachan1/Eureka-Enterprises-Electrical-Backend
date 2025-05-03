import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';
import { AUTH_DTO_ERRORS } from '../constants/auth.constants';

export class ResetPasswordDto {
  @ApiProperty({ description: 'New password', example: 'newPassword123@', required: true })
  @IsString()
  @MinLength(8, { message: AUTH_DTO_ERRORS.PASSWORD_LENGTH })
  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
    message: AUTH_DTO_ERRORS.PASSWORD_STRENGTH,
  })
  newPassword: string;

  @ApiProperty({ description: 'Confirm password', example: 'newPassword123@', required: true })
  @IsString()
  confirmPassword: string;
}
