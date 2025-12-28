import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString, IsBoolean } from 'class-validator';
import { IsValidConfigValue, IsLeaveConfigValid } from '../decorators/config-value.decorator';

export class CreateConfigSettingDto {
  @ApiProperty({ description: 'Configuration ID' })
  @IsUUID()
  @IsLeaveConfigValid()
  configId: string;

  @ApiProperty({
    description: 'Context key <mostly-financial-year>',
    example: '2025-2026',
    required: false,
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
  @IsValidConfigValue()
  value: any;

  @ApiProperty({ description: 'Effective from date', example: '2025-04-01', required: false })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiProperty({ description: 'Effective to date', example: '2026-03-31', required: false })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  // Internal flags for system/cron operations (not exposed in API)
  @IsOptional()
  @IsBoolean()
  isSystemOperation?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
