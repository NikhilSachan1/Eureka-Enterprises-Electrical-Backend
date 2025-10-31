import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetEventTypes } from 'src/modules/asset-masters/constants/asset-masters.constants';

export class CreateAssetEventDto {
  @ApiProperty({
    description: 'The ID of the asset',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  assetMasterId: string;

  @ApiProperty({
    description: 'The type of the event',
    example: AssetEventTypes.ASSET_ADDED,
  })
  @IsNotEmpty()
  @IsEnum(AssetEventTypes)
  @IsString()
  eventType: AssetEventTypes;

  @ApiProperty({
    description: 'The ID of the user who created the event',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  fromUser?: string;

  @ApiProperty({
    description: 'The ID of the user who created the event',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  toUser?: string;

  @ApiProperty({
    description: 'The metadata of the event',
    example: {
      reason: 'Asset is not in good condition',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
