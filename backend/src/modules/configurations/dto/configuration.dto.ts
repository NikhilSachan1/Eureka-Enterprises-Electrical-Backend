import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ConfigurationValueType } from '../constants/configuration.constant';

export class CreateConfigurationDto {
  @ApiProperty({ description: 'Module name', example: 'leave' })
  @IsString()
  module: string;

  @ApiProperty({ description: 'Configuration key', example: 'leave_types' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Human readable label', example: 'Leave Types' })
  @IsString()
  label: string;

  @ApiProperty({
    description: 'Value type',
    example: 'json',
    enum: ConfigurationValueType,
  })
  @IsString()
  @IsEnum(ConfigurationValueType)
  valueType: string;

  @ApiProperty({ description: 'Is editable via admin panel', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEditable?: boolean;

  @ApiProperty({
    description: 'Configuration description',
    example: 'Available leave types for employees',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class GetConfigurationDto {
  @ApiProperty({ description: 'Module name', example: 'leave', required: false })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiProperty({ description: 'Configuration key', example: 'leave_types', required: false })
  @IsOptional()
  @IsString()
  key?: string;
}
