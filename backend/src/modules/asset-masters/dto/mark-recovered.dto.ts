import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class MarkRecoveredDto {
  @ApiProperty({
    description: 'Notes about the recovery (e.g. where it was found)',
    example: 'Found in basement storage during inventory check',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    description:
      'If true, automatically reverse the original recovery expense by creating a credit entry on the same employee. ' +
      'No reversal happens if no recovery expense was created during the lost flow.',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  refundRecoveryAmount?: boolean;
}
