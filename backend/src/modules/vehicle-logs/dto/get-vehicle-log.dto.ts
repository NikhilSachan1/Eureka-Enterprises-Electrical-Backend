import { IsOptional, IsUUID, IsDateString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { VehicleLogStatus } from '../constants/vehicle-logs.constants';

export class GetVehicleLogDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by vehicle ID' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filter by driver ID' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: VehicleLogStatus })
  @IsOptional()
  @IsEnum(VehicleLogStatus)
  status?: VehicleLogStatus;

  @ApiPropertyOptional({ description: 'Filter by log date (exact)', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  logDate?: string;

  @ApiPropertyOptional({ description: 'Filter from date', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date', example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Filter by anomaly status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  anomalyDetected?: boolean;

  @ApiPropertyOptional({ description: 'Include vehicle details in response' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeVehicle?: boolean;

  @ApiPropertyOptional({ description: 'Include driver details in response' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDriver?: boolean;

  @ApiPropertyOptional({ description: 'Include site details in response' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeSite?: boolean;

  @ApiPropertyOptional({ description: 'Include files in response' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeFiles?: boolean;
}
