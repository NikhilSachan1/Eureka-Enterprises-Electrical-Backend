import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ExitReason, FNF_DTO_ERRORS } from '../constants/fnf.constants';

export class InitiateFnfDto {
  @ApiProperty({
    description: 'User ID of the employee',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Date of exit',
    example: '2026-01-31',
  })
  @IsDateString()
  exitDate: string;

  @ApiProperty({
    description: 'Reason for exit',
    enum: ExitReason,
    example: ExitReason.RESIGNATION,
  })
  @IsEnum(ExitReason, {
    message: FNF_DTO_ERRORS.INVALID_EXIT_REASON.replace(
      '{exitReasons}',
      Object.values(ExitReason).join(', '),
    ),
  })
  exitReason: ExitReason;

  @ApiProperty({
    description: 'Last working date',
    example: '2026-01-31',
  })
  @IsDateString()
  lastWorkingDate: string;

  @ApiPropertyOptional({
    description: 'Whether notice period is waived',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  noticePeriodWaived?: boolean;

  @ApiPropertyOptional({
    description: 'Additional remarks',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
