import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ description: 'Role label', example: 'Admin' })
  @IsString()
  @IsOptional()
  label: string;

  @ApiProperty({ description: 'Role description', example: 'Admin role' })
  @IsString()
  @IsOptional()
  description: string;
}
