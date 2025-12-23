import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsNumber,
  IsEnum,
  IsOptional,
  MaxLength,
  Min,
  IsBoolean,
} from 'class-validator';
import { VehicleServiceType, VehicleServiceStatus } from '../constants/vehicle-services.constants';

export class UpdateVehicleServiceDto {
  @ApiPropertyOptional({
    description: 'Service date',
    example: '2024-12-21',
  })
  @IsOptional()
  @IsDateString()
  serviceDate?: string;

  @ApiPropertyOptional({
    description: 'Odometer reading in kilometers',
    example: 45000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  odometerReading?: number;

  @ApiPropertyOptional({
    description: 'Type of service',
    enum: VehicleServiceType,
  })
  @IsOptional()
  @IsEnum(VehicleServiceType)
  serviceType?: string;

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
  })
  @IsOptional()
  @IsEnum(VehicleServiceStatus)
  serviceStatus?: string;

  @ApiPropertyOptional({
    description: 'Whether this service resets the service interval',
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
}
