import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: 'Role name', example: 'ADMIN' })
  @Transform(({ value }) => value?.toUpperCase())
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Role description', example: 'Admin role' })
  @IsString()
  @IsNotEmpty()
  description?: string;
}
