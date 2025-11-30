import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsDateString, IsEnum, IsArray, IsString, IsUUID } from 'class-validator';
import { BaseGetDto } from '../../../utils/base-dto/base-get-dto';
import { ApprovalStatus, FuelExpenseSortableFields } from '../constants/fuel-expense.constants';

export class FuelExpenseQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Sort field',
    enum: FuelExpenseSortableFields,
    required: false,
  })
  @IsOptional()
  @IsEnum(FuelExpenseSortableFields)
  @IsString()
  sortField?: string = 'createdAt';

  @ApiProperty({
    description: 'Start date (YYYY-MM-DD)',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date (YYYY-MM-DD)',
    example: '2024-01-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Specific date (YYYY-MM-DD)',
    example: '2024-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: 'Vehicle ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiProperty({
    description: 'Card ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiProperty({
    description: 'User IDs',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  userIds?: string[];

  @ApiProperty({
    description: 'Approval statuses',
    enum: ApprovalStatus,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ApprovalStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  approvalStatuses?: ApprovalStatus[];

  @ApiProperty({
    description: 'Search by description, transaction ID, or vehicle registration',
    example: 'petrol',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
