import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  VehicleMasterSortFields,
  VehicleStatus,
  VehicleFuelType,
  DocumentStatus,
  ServiceDueStatus,
  VEHICLE_DTO_ERRORS,
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
    description: 'Filter by fuel types (supports multiple values)',
    enum: VehicleFuelType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VehicleFuelType, {
    each: true,
    message: VEHICLE_DTO_ERRORS.INVALID_FUEL_TYPE.replace(
      '{fuelTypes}',
      Object.values(VehicleFuelType).join(', '),
    ),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  fuelTypes?: VehicleFuelType[];

  @ApiPropertyOptional({
    description: 'Filter by vehicle statuses (supports multiple values)',
    enum: VehicleStatus,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VehicleStatus, {
    each: true,
    message: VEHICLE_DTO_ERRORS.INVALID_STATUS.replace(
      '{statuses}',
      Object.values(VehicleStatus).join(', '),
    ),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  statuses?: VehicleStatus[];

  @ApiPropertyOptional({
    description: 'Filter by insurance statuses (computed, supports multiple values)',
    enum: DocumentStatus,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DocumentStatus, {
    each: true,
    message: VEHICLE_DTO_ERRORS.INVALID_INSURANCE_STATUS.replace(
      '{documentStatuses}',
      Object.values(DocumentStatus).join(', '),
    ),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  insuranceStatuses?: DocumentStatus[];

  @ApiPropertyOptional({
    description: 'Filter by PUC statuses (computed, supports multiple values)',
    enum: DocumentStatus,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DocumentStatus, {
    each: true,
    message: VEHICLE_DTO_ERRORS.INVALID_PUC_STATUS.replace(
      '{documentStatuses}',
      Object.values(DocumentStatus).join(', '),
    ),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  pucStatuses?: DocumentStatus[];

  @ApiPropertyOptional({
    description: 'Filter by fitness statuses (computed, supports multiple values)',
    enum: DocumentStatus,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DocumentStatus, {
    each: true,
    message: VEHICLE_DTO_ERRORS.INVALID_FITNESS_STATUS.replace(
      '{documentStatuses}',
      Object.values(DocumentStatus).join(', '),
    ),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  fitnessStatuses?: DocumentStatus[];

  @ApiPropertyOptional({
    description: 'Filter by service due statuses (computed, supports multiple values)',
    enum: ServiceDueStatus,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ServiceDueStatus, {
    each: true,
    message: VEHICLE_DTO_ERRORS.INVALID_SERVICE_DUE_STATUS.replace(
      '{serviceDueStatuses}',
      Object.values(ServiceDueStatus).join(', '),
    ),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  serviceDueStatuses?: ServiceDueStatus[];

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
  @IsEnum(VehicleMasterSortFields, {
    message: VEHICLE_DTO_ERRORS.INVALID_SORT_FIELD.replace(
      '{sortFields}',
      Object.values(VehicleMasterSortFields).join(', '),
    ),
  })
  @Transform(({ value }) => value || VehicleMasterSortFields.CREATED_AT)
  sortField?: string = VehicleMasterSortFields.CREATED_AT;
}
