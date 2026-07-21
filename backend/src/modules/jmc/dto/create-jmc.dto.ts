import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsDateString,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JmcItemDto } from './jmc-item.dto';

export class CreateJmcDto {
  @ApiProperty({ description: 'Parent PO ID' })
  @IsUUID('4')
  poId: string;

  @ApiPropertyOptional({
    description:
      'JMC Number. Optional — omit to auto-generate (SALE flow). Provide to set manually.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  jmcNumber?: string;

  @ApiProperty({ description: 'JMC Date (ISO)' })
  @IsDateString()
  jmcDate: string;

  @ApiPropertyOptional({
    description:
      'S3 file key of the signed JMC. Optional at create — the signed copy can be uploaded ' +
      'later via PATCH /jmcs/:id/upload. Required (on the record) before approval.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsOptional()
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({
    type: [JmcItemDto],
    description: 'Line items (SALE only). Presence marks the JMC as system-generated.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => JmcItemDto)
  items?: JmcItemDto[];

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
