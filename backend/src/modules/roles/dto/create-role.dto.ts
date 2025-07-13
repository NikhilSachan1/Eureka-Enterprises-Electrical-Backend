import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: 'Role name', example: 'ADMIN' })
  @Transform(({ value }) => value?.toUpperCase())
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Role label', example: 'Admin' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ description: 'Role description', example: 'Admin role' })
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiProperty({
    description: 'Is editable',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isEditable?: boolean;

  @ApiProperty({
    description: 'Is deletable',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isDeletable?: boolean;
}
