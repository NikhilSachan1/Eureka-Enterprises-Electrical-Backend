import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsBoolean } from 'class-validator';

export class GetConfigSettingDto {
  @ApiProperty({ description: 'Configuration ID', required: false })
  @IsOptional()
  @IsUUID()
  configId?: string;

  @ApiProperty({ description: 'Context key', required: false })
  @IsOptional()
  @IsString()
  contextKey?: string;

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
