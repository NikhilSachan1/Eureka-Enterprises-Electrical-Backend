import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ description: 'Role description', example: 'Admin role' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
