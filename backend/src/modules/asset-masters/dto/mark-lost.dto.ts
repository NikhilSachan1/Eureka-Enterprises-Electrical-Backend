import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MarkLostDto {
  @ApiProperty({
    description: 'Reason / circumstances for marking the asset as lost',
    example: 'Stolen from Mumbai site',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @ApiProperty({
    description: 'Date when the asset was last seen (YYYY-MM-DD)',
    example: '2026-04-25',
  })
  @IsDateString()
  @IsNotEmpty()
  lastSeenDate: string;

  @ApiProperty({
    description: 'Location where the asset was last seen',
    example: 'Mumbai Site - Warehouse',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  lastSeenLocation: string;

  @ApiProperty({
    description:
      'Recovery amount (in INR) to charge the previously assigned employee. ' +
      'Pass 0 (default) for write-off. If asset was unassigned, this is ignored.',
    example: '5000',
    required: false,
    default: '0',
  })
  @IsOptional()
  @IsNumberString({ no_symbols: false })
  recoveryAmount?: string;
}
