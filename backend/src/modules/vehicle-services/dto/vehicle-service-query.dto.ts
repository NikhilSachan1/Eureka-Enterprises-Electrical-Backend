import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  VehicleServiceType,
  VehicleServiceStatus,
  VehicleServiceSortFields,
} from '../constants/vehicle-services.constants';

export class VehicleServiceQueryDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Filter by vehicle ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  vehicleMasterId?: string;

  @ApiPropertyOptional({
    description: 'Filter by service type',
    enum: VehicleServiceType,
  })
  @IsOptional()
  @IsEnum(VehicleServiceType)
  serviceType?: string;

  @ApiPropertyOptional({
    description: 'Filter by service status',
    enum: VehicleServiceStatus,
  })
  @IsOptional()
  @IsEnum(VehicleServiceStatus)
  serviceStatus?: string;

  @ApiPropertyOptional({
    description: 'Filter by service date from',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  serviceDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by service date to',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  serviceDateTo?: string;

  @ApiPropertyOptional({
    description: 'Search by service center name or details',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: VehicleServiceSortFields,
    default: VehicleServiceSortFields.SERVICE_DATE,
  })
  @IsOptional()
  @IsEnum(VehicleServiceSortFields)
  @Transform(({ value }) => value || VehicleServiceSortFields.SERVICE_DATE)
  sortField?: string = VehicleServiceSortFields.SERVICE_DATE;
}
