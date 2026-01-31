import { IsOptional, IsInt, IsString, IsBoolean, Min, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateVehicleLogDto {
  // Start entry updates
  @ApiPropertyOptional({ description: 'Start odometer reading (km)', example: 45000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startOdometerReading?: number;

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

  // End entry (provide to complete a STARTED log)
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

  @ApiPropertyOptional({ description: 'Anomaly reason (if flagged)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  anomalyReason?: string;

  // Admin only - odometer reset flag
  @ApiPropertyOptional({
    description: 'Odometer reset flag (Admin/HR only - after service/repair)',
  })
  @IsOptional()
  @IsBoolean()
  odometerResetFlag?: boolean;
}
