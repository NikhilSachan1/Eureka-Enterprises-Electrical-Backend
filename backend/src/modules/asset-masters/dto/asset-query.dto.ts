import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  AssetMasterSortFields,
  AssetType,
  AssetStatus,
  CalibrationStatus,
  WarrantyStatus,
} from '../constants/asset-masters.constants';

export class AssetQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Search by asset ID',
    example: 'AST-TL-201',
    required: false,
  })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty({
    description: 'Search by name',
    example: 'Combination Plyer',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Search by model',
    example: 'HP ProBook 440 G9',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    description: 'Search by serial number',
    example: 'MIT1025-88941',
    required: false,
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiProperty({
    description: 'Filter by category',
    example: 'Hand Tool',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Filter by asset type',
    enum: AssetType,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  @ApiProperty({
    description: 'Filter by status',
    enum: AssetStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiProperty({
    description: 'Filter by calibration status (computed)',
    enum: CalibrationStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(CalibrationStatus)
  calibrationStatus?: CalibrationStatus;

  @ApiProperty({
    description: 'Filter by warranty status (computed)',
    enum: WarrantyStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(WarrantyStatus)
  warrantyStatus?: WarrantyStatus;

  @ApiProperty({
    description: 'Filter by assigned user',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiProperty({
    description: 'General search (searches assetId, name, serialNumber)',
    example: 'Plyer',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Sort field',
    enum: AssetMasterSortFields,
    example: AssetMasterSortFields.CREATED_AT,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(AssetMasterSortFields)
  @Transform(({ value }) => value || AssetMasterSortFields.CREATED_AT)
  sortField?: string = AssetMasterSortFields.CREATED_AT;
}
