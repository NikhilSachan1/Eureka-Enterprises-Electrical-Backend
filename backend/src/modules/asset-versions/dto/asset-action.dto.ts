import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { AssetEventTypes } from 'src/modules/asset-masters/constants/asset-masters.constants';

export class AssetActionDto {
  @ApiProperty({
    description: 'The ID of the asset',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  assetMasterId: string;

  @ApiProperty({
    description: 'The action to perform',
    enum: [
      AssetEventTypes.HANDOVER_INITIATED,
      AssetEventTypes.HANDOVER_ACCEPTED,
      AssetEventTypes.HANDOVER_REJECTED,
      AssetEventTypes.HANDOVER_CANCELLED,
      AssetEventTypes.UNDER_MAINTENANCE,
      AssetEventTypes.DEALLOCATED,
      AssetEventTypes.AVAILABLE,
    ],
    example: AssetEventTypes.HANDOVER_INITIATED,
  })
  @IsNotEmpty()
  @IsEnum([
    AssetEventTypes.HANDOVER_INITIATED,
    AssetEventTypes.HANDOVER_ACCEPTED,
    AssetEventTypes.HANDOVER_REJECTED,
    AssetEventTypes.HANDOVER_CANCELLED,
    AssetEventTypes.UNDER_MAINTENANCE,
    AssetEventTypes.DEALLOCATED,
    AssetEventTypes.AVAILABLE,
  ])
  action: AssetEventTypes;

  @ApiProperty({
    description: 'The ID of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  toUserId: string;

  @ApiProperty({
    description: 'The metadata of the asset event',
    example: {
      reason: 'Asset is not in good condition',
    },
  })
  @IsOptional()
  metadata: Record<string, any>;

  @ApiProperty({
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: true,
  })
  assetFiles: any;

  //TODO: Asset file is only necessary for few asset events. Need to discuss
}
