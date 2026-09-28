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
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JmcItemDto } from './jmc-item.dto';

/**
 * `noJmc: true` raises a No-JMC entry instead of an ordinary JMC: a record that exists only so a
 * Supply Item invoice has something to hang off. It carries no number, no date of its own and no
 * signed copy, so every other field here is ignored for it — send `poId` and the flag, nothing else.
 */
export class CreateJmcDto {
  @ApiProperty({ description: 'Parent PO ID' })
  @IsUUID('4')
  poId: string;

  @ApiPropertyOptional({
    description:
      'Create a No-JMC entry against this PO. Allowed only on an APPROVED, PURCHASE, Supply Item ' +
      'PO. All other fields are ignored. The entry then appears in the invoice JMC dropdown as ' +
      '"No JMC — <party> — <date>".',
  })
  @IsOptional()
  @IsBoolean()
  noJmc?: boolean;

  @ApiPropertyOptional({
    description:
      'JMC Number. Optional — omit to auto-generate (SALE flow). Provide to set manually. ' +
      'Never applies to a No-JMC entry, which has no number.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  jmcNumber?: string;

  @ApiPropertyOptional({ description: 'JMC Date (ISO). Not required for a No-JMC entry.' })
  @ValidateIf((o) => o.noJmc !== true)
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
