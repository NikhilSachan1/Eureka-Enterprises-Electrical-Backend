import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  IsEnum,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { VehicleFuelType, VehicleStatus } from '../constants/vehicle-masters.constants';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Vehicle Registration No', example: 'MP01KK2345' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  registrationNo: string;

  @ApiProperty({ description: 'Vehicle brand', example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  brand: string;

  @ApiProperty({ description: 'Vehicle model', example: 'Fortuner' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model: string;

  @ApiProperty({ description: 'Vehicle mileage', example: '15000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  mileage: string;

  @ApiPropertyOptional({
    description: 'Fuel type',
    enum: VehicleFuelType,
    example: VehicleFuelType.PETROL,
  })
  @IsOptional()
  @IsEnum(VehicleFuelType)
  fuelType?: string;

  @ApiPropertyOptional({
    description: 'Vehicle status',
    enum: VehicleStatus,
    example: VehicleStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: string;

  // Purchase Info
  @ApiPropertyOptional({ description: 'Purchase date', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: 'Dealer/Vendor name', example: 'ABC Motors' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dealerName?: string;

  // Insurance
  @ApiPropertyOptional({ description: 'Insurance start date', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  insuranceStartDate?: string;

  @ApiPropertyOptional({ description: 'Insurance end date', example: '2025-01-14' })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.insuranceStartDate)
  insuranceEndDate?: string;

  // PUC
  @ApiPropertyOptional({ description: 'PUC start date', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  pucStartDate?: string;

  @ApiPropertyOptional({ description: 'PUC end date', example: '2024-07-14' })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.pucStartDate)
  pucEndDate?: string;

  // Fitness
  @ApiPropertyOptional({ description: 'Fitness start date', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  fitnessStartDate?: string;

  @ApiPropertyOptional({ description: 'Fitness end date', example: '2025-01-14' })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.fitnessStartDate)
  fitnessEndDate?: string;

  // Assignment
  @ApiPropertyOptional({
    description: 'User ID to whom vehicle is assigned',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  // Remarks
  @ApiPropertyOptional({ description: 'Additional remarks', example: 'Regular maintenance done' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Additional data',
    example: { color: 'Red', year: 2020 },
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsObject()
  additionalData?: Record<string, any>;

  @ApiProperty({
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  vehicleFiles?: any;
}
