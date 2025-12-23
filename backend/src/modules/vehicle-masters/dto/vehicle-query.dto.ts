import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  VehicleMasterSortFields,
  VehicleStatus,
  VehicleFuelType,
  DocumentStatus,
  ServiceDueStatus,
} from '../constants/vehicle-masters.constants';

export class VehicleQueryDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Search by registration number',
    example: 'MP01KK2345',
  })
  @IsOptional()
  @IsString()
  registrationNo?: string;

  @ApiPropertyOptional({
    description: 'Search by brand',
    example: 'Toyota',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Search by model',
    example: 'Fortuner',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Search by mileage',
    example: '15000',
  })
  @IsOptional()
  @IsString()
  mileage?: string;

  @ApiPropertyOptional({
    description: 'Filter by fuel type',
    enum: VehicleFuelType,
  })
  @IsOptional()
  @IsEnum(VehicleFuelType)
  fuelType?: string;

  @ApiPropertyOptional({
    description: 'Filter by vehicle status',
    enum: VehicleStatus,
  })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by insurance status (computed)',
    enum: DocumentStatus,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  insuranceStatus?: string;

  @ApiPropertyOptional({
    description: 'Filter by PUC status (computed)',
    enum: DocumentStatus,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  pucStatus?: string;

  @ApiPropertyOptional({
    description: 'Filter by fitness status (computed)',
    enum: DocumentStatus,
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  fitnessStatus?: string;

  @ApiPropertyOptional({
    description: 'Filter by service due status (computed)',
    enum: ServiceDueStatus,
  })
  @IsOptional()
  @IsEnum(ServiceDueStatus)
  serviceDueStatus?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'General search across multiple fields',
    example: 'Toyota',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: VehicleMasterSortFields,
    default: VehicleMasterSortFields.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(VehicleMasterSortFields)
  @Transform(({ value }) => value || VehicleMasterSortFields.CREATED_AT)
  sortField?: string = VehicleMasterSortFields.CREATED_AT;
}
