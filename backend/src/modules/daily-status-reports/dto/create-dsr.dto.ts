import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  IsNumber,
  Min,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class CreateDsrDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  @IsNotEmpty()
  siteId: string;

  @ApiProperty({ description: 'Report date', example: '2026-01-28' })
  @IsDateString()
  @IsNotEmpty()
  reportDate: string;

  @ApiPropertyOptional({
    description: 'Work types performed (array of work type values from config)',
    example: ['Testing', 'Installation'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  workTypes?: string[];

  @ApiPropertyOptional({ description: 'Description of work performed' })
  @IsString()
  @IsOptional()
  workDescription?: string;

  @ApiPropertyOptional({ description: 'Challenges faced during work' })
  @IsString()
  @IsOptional()
  challenges?: string;

  @ApiPropertyOptional({ description: 'Reporting engineer name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reportingEngineerName?: string;

  @ApiPropertyOptional({ description: 'Reporting engineer contact number' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  reportingEngineerContact?: string;

  @ApiPropertyOptional({
    description: 'Weather condition (SUNNY, RAINY, CLOUDY)',
    example: 'SUNNY',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  weatherCondition?: string;

  @ApiPropertyOptional({ description: 'Number of people worked', example: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  manpowerCount?: number;

  @ApiPropertyOptional({
    description: 'Equipment used (array of asset version IDs)',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  equipmentUsed?: string[];

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
