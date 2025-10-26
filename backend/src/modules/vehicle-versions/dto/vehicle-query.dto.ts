import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { VehicleVersionSortFields } from '../constants/vehicle-versions.constants';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VehicleVersionsQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Search by number',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiProperty({
    description: 'Search by brand',
    example: 'Toyota',
    required: false,
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({
    description: 'Search by model',
    example: 'Fortuner',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    description: 'Search by mileage',
    example: '23',
    required: false,
  })
  @IsOptional()
  @IsString()
  mileage?: string;

  @ApiProperty({
    description: 'Sort field',
    example: 'createdAt',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(VehicleVersionSortFields)
  sortField?: string = VehicleVersionSortFields.CREATED_AT;
}
