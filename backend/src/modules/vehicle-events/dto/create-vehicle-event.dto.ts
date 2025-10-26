import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';

export class CreateVehicleEventDto {
  @ApiProperty({
    description: 'The ID of the vehicle',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleMasterId: string;

  @ApiProperty({
    description: 'The type of the event',
    example: VehicleEventTypes.VEHICLE_ADDED,
  })
  @IsNotEmpty()
  @IsEnum(VehicleEventTypes)
  @IsString()
  eventType: VehicleEventTypes;

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
      reason: 'Vehicle is not in good condition',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
