import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';
import {
  VEHICLE_EVENTS_ERRORS,
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
    description: 'Search by event type',
    example: 'VEHICLE_ADDED',
    required: false,
  })
  @IsOptional()
  @IsEnum(VehicleEventTypes, {
    message: VEHICLE_EVENTS_ERRORS.INVALID_EVENT_TYPE + Object.values(VehicleEventTypes).toString(),
  })
  @IsString()
  eventType?: string;

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
