import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ description: 'Permission name', example: 'LEAVE_ADD_BUTTON' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Module name', example: 'leave' })
  @IsString()
  module: string;

  @ApiProperty({
    description: 'Human readable label',
    example: 'Add Leave Button',
    required: false,
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: 'Permission description',
    example: 'Allows user to add new leave requests',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
