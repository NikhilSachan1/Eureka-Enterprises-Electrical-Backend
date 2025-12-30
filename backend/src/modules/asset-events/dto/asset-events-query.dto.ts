import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssetEventTypes } from 'src/modules/asset-masters/constants/asset-masters.constants';
import {
  ASSET_EVENTS_ERRORS,
  AssetEventsSortableFields,
} from '../constants/asset-events.constants';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class AssetEventsQueryDto extends BaseGetDto {
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
    description: 'Filter by event types',
    enum: AssetEventTypes,
    isArray: true,
    example: ['ASSET_ADDED', 'ASSIGNED'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AssetEventTypes, {
    each: true,
    message: ASSET_EVENTS_ERRORS.INVALID_EVENT_TYPE + Object.values(AssetEventTypes).toString(),
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  eventTypes?: AssetEventTypes[];

  @ApiProperty({
    description: 'Filter by to user (assignee - who received the asset)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  toUser?: string;

  @ApiProperty({
    description: 'Filter by from user (who transferred the asset)',
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
    enum: AssetEventsSortableFields,
    example: AssetEventsSortableFields.CREATED_AT,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetEventsSortableFields)
  sortField?: AssetEventsSortableFields = AssetEventsSortableFields.CREATED_AT;
}
