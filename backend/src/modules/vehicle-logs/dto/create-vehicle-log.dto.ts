import {
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsInt,
  IsString,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateVehicleLogDto {
  @ApiPropertyOptional({
    description: 'Vehicle ID (optional - derived from user if not provided by HR/Admin)',
  })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiProperty({ description: 'Log date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsNotEmpty()
  @IsDateString()
  logDate: string;

  // Start entry (required)
  @ApiProperty({ description: 'Start odometer reading (km)', example: 45000 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startOdometerReading: number;

  @ApiPropertyOptional({ description: 'Start time (HH:MM)', example: '08:30' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:MM format' })
  startTime?: string;

  @ApiPropertyOptional({ description: 'Start location', example: 'Office' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  startLocation?: string;

  // End entry (optional - if provided, log is completed in one call)
  @ApiPropertyOptional({
    description: 'End odometer reading (km) - provide to complete log',
    example: 45050,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  endOdometerReading?: number;

  @ApiPropertyOptional({ description: 'End time (HH:MM)', example: '18:30' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:MM format' })
  endTime?: string;

  @ApiPropertyOptional({ description: 'End location', example: 'Adani Bhopal Site' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  endLocation?: string;

  // Other fields
  @ApiPropertyOptional({ description: 'Purpose of the trip', example: 'Site visit' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  purpose?: string;

  @ApiPropertyOptional({ description: 'Driver remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  driverRemarks?: string;
}
