import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AssetType, AssetStatus } from '../constants/asset-masters.constants';

export class UpdateAssetDto {
  // ==================== Master Info ====================
  @ApiProperty({ description: 'Asset name', example: 'Combination Plyer', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ description: 'Asset model', example: '8 Inch (Local)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  model?: string;

  @ApiProperty({ description: 'Serial number', example: 'MIT1025-88941', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serialNumber?: string;

  @ApiProperty({
    description: 'Asset category (from config)',
    example: 'Hand Tool',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiProperty({
    description: 'Asset type',
    enum: AssetType,
    example: AssetType.NON_CALIBRATED,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  // ==================== Calibration ====================
  @ApiProperty({
    description: 'Calibration source (from config)',
    example: 'NABL',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  calibrationFrom?: string;

  @ApiProperty({
    description: 'Calibration frequency (from config)',
    example: '12 Months',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  calibrationFrequency?: string;

  @ApiProperty({
    description: 'Calibration start date',
    example: '2024-08-25',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  calibrationStartDate?: string;

  @ApiProperty({
    description: 'Calibration end date',
    example: '2025-08-24',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  calibrationEndDate?: string;

  // ==================== Purchase & Warranty ====================
  @ApiProperty({ description: 'Purchase date', example: '2024-01-15', required: false })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiProperty({ description: 'Vendor name', example: 'HP India Sales Pvt Ltd', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  vendorName?: string;

  @ApiProperty({ description: 'Warranty start date', example: '2024-01-15', required: false })
  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @ApiProperty({ description: 'Warranty end date', example: '2027-01-14', required: false })
  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  // ==================== Status ====================
  @ApiProperty({
    description: 'Asset status',
    enum: AssetStatus,
    example: AssetStatus.AVAILABLE,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiProperty({
    description: 'Assigned to user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiProperty({ description: 'Remarks/Notes', example: 'General use hand tool', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;

  // ==================== Additional ====================
  @ApiProperty({
    description: 'Additional data (JSON)',
    example: { location: 'Warehouse A' },
    required: false,
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
    description: 'Files to be uploaded (images, certificates)',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  assetFiles?: any;
}
