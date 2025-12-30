import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { AssetEventTypes } from 'src/modules/asset-masters/constants/asset-masters.constants';

/**
 * Asset Action DTO
 *
 * Action-specific requirements:
 * | Action              | toUserId           | Files      |
 * |---------------------|-------------------|------------|
 * | HANDOVER_INITIATED  | Required          | Required   |
 * | HANDOVER_ACCEPTED   | Derived (JWT)     | Required   |
 * | HANDOVER_REJECTED   | Derived (JWT)     | Optional   |
 * | HANDOVER_CANCELLED  | Derived (JWT)     | Optional   |
 * | DEALLOCATED         | Auto (assignedTo) | Optional   |
 * | UNDER_MAINTENANCE   | Not needed        | Optional   |
 * | AVAILABLE           | Not needed        | Not needed |
 * | CALIBRATED          | Not needed        | Required   |
 * | DAMAGED             | Not needed        | Optional   |
 * | RETIRED             | Not needed        | Optional   |
 */
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
      AssetEventTypes.CALIBRATED,
      AssetEventTypes.DAMAGED,
      AssetEventTypes.RETIRED,
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
    AssetEventTypes.CALIBRATED,
    AssetEventTypes.DAMAGED,
    AssetEventTypes.RETIRED,
  ])
  action: AssetEventTypes;

  @ApiProperty({
    description: 'The ID of the target user (required only for HANDOVER_INITIATED)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  toUserId?: string;

  @ApiProperty({
    description: 'The metadata of the asset event (e.g., reason for action)',
    example: {
      reason: 'Asset is not in good condition',
    },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    description:
      'Files to be uploaded (required for HANDOVER_INITIATED, HANDOVER_ACCEPTED, CALIBRATED)',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  assetFiles?: any;
}
