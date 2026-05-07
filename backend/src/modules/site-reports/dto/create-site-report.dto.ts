import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateSiteReportDto {
  @ApiProperty({ description: 'Parent JMC ID' })
  @IsUUID('4')
  jmcId: string;

  @ApiProperty({ description: 'Report Number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reportNumber: string;

  @ApiProperty({ description: 'Report Date (ISO)' })
  @IsDateString()
  reportDate: string;

  @ApiProperty({ description: 'S3 file key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileKey: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
