import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';

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

export class BulkDeleteByUsersDto {
  @ApiProperty({
    description: 'Array of User IDs whose permission overrides should be deleted',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one user ID is required' })
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  userIds: string[];
}
