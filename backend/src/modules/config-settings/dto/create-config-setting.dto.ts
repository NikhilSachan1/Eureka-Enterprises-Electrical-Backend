import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { IsValidConfigValue } from '../decorators/config-value.decorator';

export class CreateConfigSettingDto {
  @ApiProperty({ description: 'Configuration ID' })
  @IsUUID()
  configId: string;

  @ApiProperty({ description: 'Context key', example: '2025', required: false })
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

  @ApiProperty({ description: 'Effective from date', example: '2025-01-01', required: false })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiProperty({ description: 'Effective to date', example: '2025-12-31', required: false })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
