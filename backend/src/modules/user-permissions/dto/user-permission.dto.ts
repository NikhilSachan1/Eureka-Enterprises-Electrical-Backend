import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsBoolean, IsArray } from 'class-validator';

export class CreateUserPermissionDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Permission ID' })
  @IsUUID()
  permissionId: string;

  @ApiProperty({ description: 'Whether permission is granted or revoked' })
  @IsBoolean()
  isGranted: boolean;
}

export class BulkCreateUserPermissionsDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Array of permission grants/revokes' })
  @IsArray()
  permissions: Array<{
    permissionId: string;
    isGranted: boolean;
  }>;
}
