import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsUUID, IsArray, IsNotEmpty, ValidateNested, IsBoolean } from 'class-validator';

export class CreateUserPermissionDto {
  @ApiProperty({ description: 'Permission ID', example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsUUID()
  @IsNotEmpty()
  permissionId: string;

  @ApiProperty({ description: 'Is active', example: true })
  @IsBoolean()
  @IsNotEmpty()
  isGranted: boolean;
}

export class BulkCreateUserPermissionsDto {
  @ApiProperty({ description: 'Role ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Array of permission IDs',
    type: [CreateUserPermissionDto],
    example: [
      {
        permissionId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: true,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserPermissionDto)
  @IsNotEmpty()
  userPermissions: CreateUserPermissionDto[];
}
