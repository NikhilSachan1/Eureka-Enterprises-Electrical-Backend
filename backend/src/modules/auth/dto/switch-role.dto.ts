import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SwitchRoleDto {
  @ApiProperty({
    description: 'The role name to switch to',
    example: 'ADMIN',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Target role is required' })
  @MinLength(1, { message: 'Target role cannot be empty' })
  targetRole: string;
}
