import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetEventTypes } from 'src/modules/asset-masters/constants/asset-masters.constants';
import { ASSET_EVENTS_ERRORS } from '../constants/asset-events.constants';

export class AssetEventsQueryDto {
  @ApiProperty({
    description: 'Search by event type',
    example: 'ASSET_ADDED',
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetEventTypes, {
    message: ASSET_EVENTS_ERRORS.INVALID_EVENT_TYPE + Object.values(AssetEventTypes).toString(),
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
}
