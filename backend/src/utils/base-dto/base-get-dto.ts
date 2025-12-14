import { IsEnum, IsString, IsOptional, Min, IsNumber, Max } from 'class-validator';
import { DefaultPaginationValues, PAGNIATION_ERRORS } from '../utility/constants/utility.constants';
import { ApiProperty } from '@nestjs/swagger';
import { SortOrder } from '../utility/constants/utility.constants';
import { Transform } from 'class-transformer';

export class BaseGetDto {
  @ApiProperty({
    description: 'Order of sorting',
    enum: SortOrder,
    example: SortOrder.ASC,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: PAGNIATION_ERRORS.INVALID_SORT_ORDER })
  sortOrder?: string = DefaultPaginationValues.SORT_ORDER;

  @ApiProperty({ description: 'Column to be sorted by', example: 'createdAt', required: false })
  @IsOptional()
  @IsString()
  sortField?: string = DefaultPaginationValues.SORT_FIELD;

  @ApiProperty({ description: 'Number of items to be displayed', example: 10, required: false })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = DefaultPaginationValues.PAGE_SIZE;

  @ApiProperty({ description: 'Page number to be displayed', example: 1, required: false })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = DefaultPaginationValues.PAGE;
}
