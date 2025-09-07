import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { VehicleEventTypes } from 'src/modules/vehicles/constants/vehicle.constants';

export class CreateVehicleEventDto {
  @ApiProperty({
    description: 'The ID of the vehicle',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleId: string;

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
}
