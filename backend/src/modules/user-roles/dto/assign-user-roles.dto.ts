import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';

/**
 * DTO for assigning multiple roles to a user
 * This replaces all existing roles with the new ones
 */
export class AssignUserRolesDto {
  @ApiProperty({
    description: 'Array of Role IDs to assign to the user',
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one role must be assigned' })
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  roleIds: string[];
}
