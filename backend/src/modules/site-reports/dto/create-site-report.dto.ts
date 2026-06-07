import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateSiteReportDto {
  @ApiProperty({ description: 'Parent JMC ID' })
  @IsUUID('4')
  jmcId: string;

  @ApiPropertyOptional({ description: 'Report Number (optional)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  reportNumber?: string;

  @ApiProperty({ description: 'Report Date (ISO)' })
  @IsDateString()
  reportDate: string;

  @ApiPropertyOptional({
    description: 'S3 file key (optional — upload via POST /files/site-report-upload)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsOptional()
  fileKey?: string;

  @ApiPropertyOptional({
    description: 'Original file name (optional — required when fileKey is provided)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
