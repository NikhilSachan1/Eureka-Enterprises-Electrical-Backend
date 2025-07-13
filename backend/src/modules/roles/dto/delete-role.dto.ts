import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteRoleDto {
  @ApiProperty({
    description: 'Role ids',
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
  })
  @IsArray()
  @IsNotEmpty()
  @IsUUID('4', { each: true })
  ids: string[];
}
