import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AUTH_DTO_ERRORS } from '../constants/auth.constants';

export class SignupDto {
  @ApiProperty({
    description: 'First name of the user',
    required: true,
    type: String,
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the user',
    required: true,
    type: String,
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Contact number of the user',
    required: false,
    type: String,
    example: '+919876543210',
  })
  @IsString()
  @IsOptional()
  contactNumber: string;

  @ApiProperty({
    description: 'Email address of the user',
    required: true,
    type: String,
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password - minimum 8 characters',
    required: true,
    type: String,
    minLength: 8,
    example: 'StrongP@ssw0rd',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: AUTH_DTO_ERRORS.PASSWORD_LENGTH })
  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
    message: AUTH_DTO_ERRORS.PASSWORD_STRENGTH,
  })
  password: string;

  @ApiProperty({
    description: 'Confirm password of the user',
    required: true,
    type: String,
    example: 'StrongP@ssw0rd',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @ApiProperty({
    description: 'Invitation token received via email',
    required: true,
    type: String,
    example: 'encrypted-token-string',
  })
  @IsString()
  @IsNotEmpty()
  invitationToken: string;
}
