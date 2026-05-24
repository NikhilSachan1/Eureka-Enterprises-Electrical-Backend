import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyEntryDto {
  @ApiPropertyOptional({ description: 'S3 key of verification document (optional)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Original file name (optional)' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks for verification (optional)' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
