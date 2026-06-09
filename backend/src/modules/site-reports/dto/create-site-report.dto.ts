import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateSiteReportDto {
  @ApiProperty({ description: 'Parent JMC ID' })
  @IsUUID('4')
  jmcId: string;

  @ApiPropertyOptional({ description: 'Report Number (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reportNumber?: string;

  @ApiProperty({ description: 'Report Date (ISO)' })
  @IsDateString()
  reportDate: string;

  @ApiPropertyOptional({
    description: 'S3 file key (optional — upload via POST /files/site-report-upload)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileKey?: string;

  @ApiPropertyOptional({
    description: 'Original file name (optional — required when fileKey is provided)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
