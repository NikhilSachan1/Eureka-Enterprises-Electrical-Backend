import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgetPasswordDto {
  @ApiProperty({ description: 'Email', example: 'test@example.com', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
