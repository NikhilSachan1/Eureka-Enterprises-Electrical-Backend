import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsDateString,
  IsArray,
  IsNumber,
  IsEnum,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { SortOrder } from '../../../utils/utility/constants/utility.constants';

export class FuelPendingSettlementQueryDto {
  @ApiProperty({ description: 'Page number', example: 1, required: false })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page. Omit to return all records.',
    example: 10,
    required: false,
  })
  @Transform(({ value }) => (value !== undefined ? parseInt(value) : undefined))
  @IsNumber()
  @Min(1)
  @Max(1000)
  @IsOptional()
  pageSize?: number;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.DESC,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: string = SortOrder.DESC;

  @ApiProperty({
    description: 'Filter by user IDs',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  userIds?: string[];

  @ApiProperty({ description: 'Start date filter on fillDate (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date filter on fillDate (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Search by employee first name or last name', required: false })
  @IsOptional()
  @IsString()
  search?: string;
}
