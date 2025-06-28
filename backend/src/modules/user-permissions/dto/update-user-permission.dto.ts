import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsBoolean, IsNotEmpty, IsArray } from 'class-validator';

class UpdateUserPermissionDto {
  @ApiProperty({ description: 'Permission ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  permissionId: string;

  @ApiProperty({ description: 'Is granted', example: true })
  @IsBoolean()
  @IsNotEmpty()
  isGranted: boolean;
}

export class BulkUpdateUserPermissionDto {
  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Array of permissions', type: [UpdateUserPermissionDto] })
  @IsArray()
  @IsNotEmpty()
  permissions: UpdateUserPermissionDto[];
}
