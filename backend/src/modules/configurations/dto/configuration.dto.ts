import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
  Allow,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigurationValueType } from '../constants/configuration.constant';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

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

/** Config setting data for creation (without configId) */
export class CreateConfigSettingForConfigDto {
  @ApiPropertyOptional({
    description: 'Context key <mostly-financial-year>',
    example: '2025-2026',
  })
  @IsOptional()
  @IsString()
  contextKey?: string;

  @ApiProperty({
    description: 'Configuration value (type must match configuration valueType)',
    examples: {
      json: { value: { types: ['sick', 'annual'] } },
      array: { value: ['sick', 'annual', 'casual'] },
      number: { value: 30 },
      text: { value: 'Default leave policy' },
      boolean: { value: true },
    },
  })
  @Allow()
  value: any;

  @ApiPropertyOptional({ description: 'Effective from date', example: '2025-04-01' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Effective to date', example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Create configuration with optional config settings */
export class CreateConfigurationWithSettingsDto {
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

  @ApiPropertyOptional({ description: 'Is editable via admin panel', example: true })
  @IsOptional()
  @IsBoolean()
  isEditable?: boolean;

  @ApiPropertyOptional({
    description: 'Configuration description',
    example: 'Available leave types for employees',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Config settings to create along with configuration',
    type: [CreateConfigSettingForConfigDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateConfigSettingForConfigDto)
  configSettings?: CreateConfigSettingForConfigDto[];
}

export class GetConfigurationDto extends BaseGetDto {
  @ApiProperty({ description: 'Module name', example: 'leave', required: false })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiProperty({ description: 'Configuration key', example: 'leave_types', required: false })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ description: 'Search by key or label', example: 'leave', required: false })
  @IsOptional()
  @IsString()
  search?: string;
}
