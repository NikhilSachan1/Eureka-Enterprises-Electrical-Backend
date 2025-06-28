import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class GetAllRoleDto {
  @ApiProperty({ description: 'Role name', example: 'ADMIN', required: false })
  @IsString()
  @IsOptional()
  name: string;
}
