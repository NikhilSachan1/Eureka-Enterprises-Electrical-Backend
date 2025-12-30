import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';

/**
 * Vehicle Action DTO
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
 * | DAMAGED             | Not needed        | Optional   |
 * | RETIRED             | Not needed        | Optional   |
 */
export class VehicleActionDto {
  @ApiProperty({
    description: 'The ID of the vehicle',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleMasterId: string;

  @ApiProperty({
    description: 'The action to perform',
    enum: [
      VehicleEventTypes.HANDOVER_INITIATED,
      VehicleEventTypes.HANDOVER_ACCEPTED,
      VehicleEventTypes.HANDOVER_REJECTED,
      VehicleEventTypes.HANDOVER_CANCELLED,
      VehicleEventTypes.UNDER_MAINTENANCE,
      VehicleEventTypes.DEALLOCATED,
      VehicleEventTypes.AVAILABLE,
      VehicleEventTypes.DAMAGED,
      VehicleEventTypes.RETIRED,
    ],
    example: VehicleEventTypes.HANDOVER_INITIATED,
  })
  @IsNotEmpty()
  @IsEnum([
    VehicleEventTypes.HANDOVER_INITIATED,
    VehicleEventTypes.HANDOVER_ACCEPTED,
    VehicleEventTypes.HANDOVER_REJECTED,
    VehicleEventTypes.HANDOVER_CANCELLED,
    VehicleEventTypes.UNDER_MAINTENANCE,
    VehicleEventTypes.DEALLOCATED,
    VehicleEventTypes.AVAILABLE,
    VehicleEventTypes.DAMAGED,
    VehicleEventTypes.RETIRED,
  ])
  action: VehicleEventTypes;

  @ApiProperty({
    description: 'The ID of the target user (required only for HANDOVER_INITIATED)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  toUserId?: string;

  @ApiProperty({
    description: 'The metadata of the vehicle event (e.g., reason for action)',
    example: {
      reason: 'Vehicle is not in good condition',
    },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Files to be uploaded (required for HANDOVER_INITIATED, HANDOVER_ACCEPTED)',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  vehicleFiles?: any;
}
