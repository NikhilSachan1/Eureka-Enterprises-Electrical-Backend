import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray } from 'class-validator';

export class CreateRolePermissionDto {
  @ApiProperty({ description: 'Role ID' })
  @IsUUID()
  roleId: string;

  @ApiProperty({ description: 'Permission ID' })
  @IsUUID()
  permissionId: string;
}

export class BulkCreateRolePermissionsDto {
  @ApiProperty({ description: 'Role ID' })
  @IsUUID()
  roleId: string;

  @ApiProperty({ description: 'Array of permission IDs', type: [String] })
  @IsArray()
  @IsUUID(4, { each: true })
  permissionIds: string[];
}
