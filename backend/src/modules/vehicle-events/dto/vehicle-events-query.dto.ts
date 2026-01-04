import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';
import {
  VEHICLE_EVENTS_DTO_ERRORS,
  VehicleEventsSortableFields,
} from '../constants/vehicle-events.constants';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class VehicleEventsQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Start date for filtering events (YYYY-MM-DD)',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for filtering events (YYYY-MM-DD)',
    example: '2024-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Filter by event types (supports multiple values)',
    enum: VehicleEventTypes,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VehicleEventTypes, {
    each: true,
    message: VEHICLE_EVENTS_DTO_ERRORS.INVALID_EVENT_TYPES.replace(
      '{eventTypes}',
      Object.values(VehicleEventTypes).join(', '),
    ),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  eventTypes?: VehicleEventTypes[];

  @ApiProperty({
    description: 'Search by to user',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  toUser?: string;

  @ApiProperty({
    description: 'Search by from user',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  fromUser?: string;

  @ApiProperty({
    description: 'Filter by created by user',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiProperty({
    description: 'Sort field',
    enum: VehicleEventsSortableFields,
    example: VehicleEventsSortableFields.CREATED_AT,
    required: false,
  })
  @IsOptional()
  @IsEnum(VehicleEventsSortableFields)
  sortField?: VehicleEventsSortableFields = VehicleEventsSortableFields.CREATED_AT;
}
