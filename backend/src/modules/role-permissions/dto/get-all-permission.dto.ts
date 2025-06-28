import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetAllRolePermissionDto {
  @ApiProperty({
    description: 'Role name',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  roleId: string;

  @ApiProperty({
    description: 'Permission name',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  permissionId: string;

  @ApiProperty({ description: 'Is active', example: true, required: false })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive: boolean;
}
