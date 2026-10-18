import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DELEGATABLE_MODULES } from '../constants/user-delegation.constants';

const MODULES = Object.values(DELEGATABLE_MODULES);

export class CreateDelegationDto {
  @ApiProperty({ description: 'The employee who will do the work on somebody else’s behalf' })
  @IsUUID()
  managerId: string;

  @ApiProperty({
    description:
      'The employees whose entries those will be — one grant is made per person. Anyone already ' +
      'held by this manager for this module is skipped and listed in the response, not an error.',
    type: [String],
    example: ['3f0c…', '9a21…'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  memberIds: string[];

  @ApiProperty({
    enum: MODULES,
    description:
      'Which module this covers. Only the listed ones are honoured anywhere in the code.',
  })
  @IsIn(MODULES)
  module: string;

  @ApiPropertyOptional({ description: 'Defaults to today.', example: '2026-10-17' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description: 'Leave empty for "until further notice". Setting it later withdraws the grant.',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Why this was granted — shows on the admin list.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class GetDelegationsDto {
  @ApiPropertyOptional({ enum: MODULES })
  @IsOptional()
  @IsIn(MODULES)
  module?: string;

  @ApiPropertyOptional({ description: 'Only grants held by this person' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Only grants over this person' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({
    description: 'true returns only grants in force today; omit to include withdrawn ones',
  })
  @IsOptional()
  @IsString()
  activeOnly?: string;
}

export class GetManagedUsersDto {
  @ApiProperty({ enum: MODULES })
  @IsIn(MODULES)
  module: string;
}
