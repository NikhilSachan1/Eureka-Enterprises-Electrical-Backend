import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, IsNotEmpty } from 'class-validator';

export class DeleteUserPermissionDto {
  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Permission ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  permissionId: string;
}

export class BulkDeleteUserPermissionsDto {
  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Array of permission IDs',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsNotEmpty()
  permissionIds: string[];
}
