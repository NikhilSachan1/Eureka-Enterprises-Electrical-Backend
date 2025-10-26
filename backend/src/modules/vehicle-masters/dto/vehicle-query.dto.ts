import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { VehicleMasterSortFields } from '../constants/vehicle-masters.constants';

export class VehicleQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Search by registration number',
    example: 'MP01KK2345',
    required: false,
  })
  @IsOptional()
  @IsString()
  registrationNo?: string;

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
  @IsEnum(VehicleMasterSortFields)
  sortField?: string = VehicleMasterSortFields.CREATED_AT;
}
