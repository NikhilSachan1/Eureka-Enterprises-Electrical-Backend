import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';

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
  ])
  action: VehicleEventTypes;

  @ApiProperty({
    description: 'The ID of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  toUserId: string;

  @ApiProperty({
    description: 'The metadata of the vehicle event',
    example: {
      reason: 'Vehicle is not in good condition',
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
  vehicleFiles: any;

  //TODO: Vehicle file is only necessary for few vehicle events. Need to discuss
}
