import { IsDate, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  password: string;

  @IsString()
  contactNumber: string;

  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  profilePicture?: string;

  @IsDate()
  @IsOptional()
  passwordUpdatedAt?: Date;

  @IsString()
  role: string;
}
