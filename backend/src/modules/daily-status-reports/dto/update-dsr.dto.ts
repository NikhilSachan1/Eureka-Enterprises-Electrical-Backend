import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  MaxLength,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateDsrDto {
  @ApiPropertyOptional({
    description: 'Alias for workTypes (some clients send workDone[0], workDone[1], …)',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v);
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workDone?: string[];

  @ApiPropertyOptional({ description: 'Alias for remarks' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Alias for reportingEngineerName' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reportedEngineerName?: string;

  @ApiPropertyOptional({ description: 'Alias for reportingEngineerContact' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  reportedEngineerContact?: string;

  @ApiPropertyOptional({ description: 'Alias for reportDate (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  statusDate?: string;

  @ApiPropertyOptional({ description: 'Report date when updating (same as statusDate)' })
  @IsDateString()
  @IsOptional()
  reportDate?: string;

  @ApiPropertyOptional({
    description: 'Work types performed (array of work type values from config)',
    example: ['Testing', 'Installation'],
  })
  @Transform(({ value }) => {
    // Handle multipart/form-data: convert comma-separated string to array
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v);
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
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
  @Transform(({ value }) => {
    // Handle multipart/form-data: convert comma-separated string to array
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v);
    }
    return value;
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  equipmentUsed?: string[];

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Reason for editing the DSR' })
  @IsString()
  @IsOptional()
  changeReason?: string;

  // File upload field for Swagger documentation
  @ApiPropertyOptional({
    description: 'DSR files to add (up to 5 files)',
    type: 'array',
    items: { type: 'string', format: 'binary' },
  })
  dsrFiles?: Express.Multer.File[];
}
