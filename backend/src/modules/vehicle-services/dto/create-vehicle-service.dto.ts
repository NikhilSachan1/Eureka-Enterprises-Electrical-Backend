import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsEnum,
  IsOptional,
  MaxLength,
  Min,
  IsBoolean,
} from 'class-validator';
import { VehicleServiceType, VehicleServiceStatus } from '../constants/vehicle-services.constants';

export class CreateVehicleServiceDto {
  @ApiProperty({
    description: 'Vehicle master ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleMasterId: string;

  @ApiProperty({
    description: 'Service date',
    example: '2024-12-21',
  })
  @IsNotEmpty()
  @IsDateString()
  serviceDate: string;

  @ApiProperty({
    description: 'Odometer reading in kilometers',
    example: 45000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  odometerReading: number;

  @ApiProperty({
    description: 'Type of service',
    enum: VehicleServiceType,
    example: VehicleServiceType.REGULAR_SERVICE,
  })
  @IsNotEmpty()
  @IsEnum(VehicleServiceType)
  serviceType: string;

  @ApiPropertyOptional({
    description: 'Detailed description of service performed',
    example: 'Oil change, filter replacement, brake inspection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  serviceDetails?: string;

  @ApiPropertyOptional({
    description: 'Name of service center or vendor',
    example: 'ABC Auto Service Center',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceCenterName?: string;

  @ApiPropertyOptional({
    description: 'Total service cost',
    example: 5500.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceCost?: number;

  @ApiPropertyOptional({
    description: 'Service status',
    enum: VehicleServiceStatus,
    default: VehicleServiceStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(VehicleServiceStatus)
  serviceStatus?: string;

  @ApiPropertyOptional({
    description:
      'Whether this service resets the service interval (auto-set based on service type)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  resetsServiceInterval?: boolean;

  @ApiPropertyOptional({
    description: 'Additional remarks',
    example: 'Customer requested premium oil',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Files to be uploaded',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
  })
  @IsOptional()
  serviceFiles?: any;
}
