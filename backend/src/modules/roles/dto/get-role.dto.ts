import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class GetAllRoleDto extends BaseGetDto {
  @ApiProperty({ description: 'Role name', example: 'ADMIN', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Search by label',
    example: 'Administrator',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
