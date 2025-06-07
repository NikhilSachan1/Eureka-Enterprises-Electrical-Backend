import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';
import { IsValidConfigValue } from '../decorators/config-value.decorator';

export class UpdateConfigSettingDto {
  @ApiProperty({
    description: 'Context key for versioning',
    required: false,
  })
  @IsOptional()
  @IsString()
  contextKey?: string;

  @ApiProperty({
    description: 'Configuration value',
    required: false,
  })
  @IsOptional()
  @IsValidConfigValue()
  value?: any;

  @ApiProperty({
    description: 'Effective from date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiProperty({
    description: 'Effective to date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
