import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePermissionDto {
  @ApiProperty({ description: 'Permission name', example: 'Add Leave Button' })
  @IsString()
  @IsOptional()
  label: string;

  @ApiProperty({
    description: 'Permission description',
    example: 'Allows user to add new leave requests',
  })
  @IsString()
  @IsOptional()
  description: string;
}
