import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import {
  AssetMasterSortFields,
  AssetType,
  AssetStatus,
  CalibrationStatus,
  WarrantyStatus,
} from '../constants/asset-masters.constants';

const toArray = (value: any): string[] => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value.split(',').map((v) => v.trim());
    }
  }
  return [value];
};

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
    description: 'Filter by category (supports multiple values)',
    example: ['Hand Tool', 'Power Tool'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toArray(value))
  category?: string[];

  @ApiProperty({
    description: 'Filter by asset type (supports multiple values)',
    enum: AssetType,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AssetType, { each: true })
  @Transform(({ value }) => toArray(value))
  assetType?: AssetType[];

  @ApiProperty({
    description: 'Filter by status (supports multiple values)',
    enum: AssetStatus,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AssetStatus, { each: true })
  @Transform(({ value }) => toArray(value))
  status?: AssetStatus[];

  @ApiProperty({
    description: 'Filter by calibration status (supports multiple values)',
    enum: CalibrationStatus,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(CalibrationStatus, { each: true })
  @Transform(({ value }) => toArray(value))
  calibrationStatus?: CalibrationStatus[];

  @ApiProperty({
    description: 'Filter by warranty status (supports multiple values)',
    enum: WarrantyStatus,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WarrantyStatus, { each: true })
  @Transform(({ value }) => toArray(value))
  warrantyStatus?: WarrantyStatus[];

  @ApiProperty({
    description: 'Filter by assigned user (supports multiple values)',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => toArray(value))
  assignedTo?: string[];

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
