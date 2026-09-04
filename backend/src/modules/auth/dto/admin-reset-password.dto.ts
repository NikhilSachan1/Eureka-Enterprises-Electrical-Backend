import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';
import { AUTH_DTO_ERRORS } from '../constants/auth.constants';

/**
 * Body for an admin setting another user's password directly.
 *
 * Rules are identical to the self-service ResetPasswordDto, so an admin-set password can never be
 * weaker than one the user would have chosen themselves.
 *
 * The field names matter: `newPassword` and `confirmPassword` are both listed in SENSITIVE_FIELDS,
 * so the request-audit interceptor masks them as [REDACTED]. Renaming either one would write a
 * plaintext credential into request_audit_logs.
 */
export class AdminResetPasswordDto {
  @ApiProperty({ description: 'New password to set for the user', example: 'newPassword123@' })
  @IsString()
  @MinLength(8, { message: AUTH_DTO_ERRORS.PASSWORD_LENGTH })
  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
    message: AUTH_DTO_ERRORS.PASSWORD_STRENGTH,
  })
  newPassword: string;

  @ApiProperty({ description: 'Confirm password', example: 'newPassword123@' })
  @IsString()
  confirmPassword: string;
}
