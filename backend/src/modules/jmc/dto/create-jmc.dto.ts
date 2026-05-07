import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class CreateJmcDto {
  @ApiProperty({ description: 'Parent PO ID' })
  @IsUUID('4')
  poId: string;

  @ApiProperty({ description: 'JMC Number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jmcNumber: string;

  @ApiProperty({ description: 'JMC Date (ISO)' })
  @IsDateString()
  jmcDate: string;

  @ApiProperty({ description: 'S3 file key for the JMC PDF/scan' })
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
