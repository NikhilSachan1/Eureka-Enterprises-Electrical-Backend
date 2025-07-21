import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  LEAVE_BALANCE_ERRORS,
  LEAVE_BALANCE_SORT_FIELDS,
} from '../constants/leave-balances.constants';
import { Transform } from 'class-transformer';

export class GetAllLeaveBalanceDto extends BaseGetDto {
  @ApiProperty({ description: 'User IDs', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  userIds?: string[];

  @ApiProperty({
    description: 'financial year',
    example: '2025-2026',
    required: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  financialYear: string;

  @ApiProperty({
    description: 'sort field',
    enum: Object.keys(LEAVE_BALANCE_SORT_FIELDS),
    required: false,
  })
  @IsOptional()
  @IsEnum(Object.keys(LEAVE_BALANCE_SORT_FIELDS), {
    message:
      LEAVE_BALANCE_ERRORS.INVALID_SORT_FIELD + Object.keys(LEAVE_BALANCE_SORT_FIELDS).join(', '),
  })
  @IsString()
  sortField?: string = 'createdAt';
}
