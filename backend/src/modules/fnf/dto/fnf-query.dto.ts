import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { FnfStatus, ExitReason, FnfSortFields } from '../constants/fnf.constants';

export class FnfQueryDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: FnfStatus,
  })
  @IsOptional()
  @IsEnum(FnfStatus)
  status?: FnfStatus;

  @ApiPropertyOptional({
    description: 'Filter by exit reason',
    enum: ExitReason,
  })
  @IsOptional()
  @IsEnum(ExitReason)
  exitReason?: ExitReason;

  @ApiPropertyOptional({
    description: 'Filter by exit date from',
  })
  @IsOptional()
  @IsDateString()
  exitDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by exit date to',
  })
  @IsOptional()
  @IsDateString()
  exitDateTo?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: FnfSortFields,
    default: FnfSortFields.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(FnfSortFields)
  sortField?: FnfSortFields;
}
