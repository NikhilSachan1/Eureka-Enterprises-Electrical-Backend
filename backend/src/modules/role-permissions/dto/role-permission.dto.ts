import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsUUID, IsArray, IsNotEmpty, ValidateNested, IsBoolean } from 'class-validator';

export class CreateRolePermissionDto {
  @ApiProperty({ description: 'Permission ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  permissionId: string;

  @ApiProperty({ description: 'Is active', example: true })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}

export class BulkCreateRolePermissionsDto {
  @ApiProperty({ description: 'Role ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty({
    description: 'Array of permission IDs',
    type: [CreateRolePermissionDto],
    example: [
      {
        permissionId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: true,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRolePermissionDto)
  @IsNotEmpty()
  rolePermissions: CreateRolePermissionDto[];
}
