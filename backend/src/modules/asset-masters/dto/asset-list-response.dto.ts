import { ApiProperty } from '@nestjs/swagger';

class StatusStatsDto {
  @ApiProperty({ example: 50 })
  available: number;

  @ApiProperty({ example: 30 })
  assigned: number;

  @ApiProperty({ example: 5 })
  underMaintenance: number;

  @ApiProperty({ example: 3 })
  damaged: number;

  @ApiProperty({ example: 2 })
  retired: number;
}

class AssetTypeStatsDto {
  @ApiProperty({ example: 40 })
  calibrated: number;

  @ApiProperty({ example: 50 })
  nonCalibrated: number;
}

class CalibrationStatsDto {
  @ApiProperty({ example: 30 })
  valid: number;

  @ApiProperty({ example: 5 })
  expiringSoon: number;

  @ApiProperty({ example: 5 })
  expired: number;
}

class WarrantyStatsDto {
  @ApiProperty({ example: 40 })
  valid: number;

  @ApiProperty({ example: 10 })
  expiringSoon: number;

  @ApiProperty({ example: 15 })
  expired: number;

  @ApiProperty({ example: 25 })
  notApplicable: number;
}

class AssetStatsDto {
  @ApiProperty({ example: 90 })
  total: number;

  @ApiProperty({ type: StatusStatsDto })
  byStatus: StatusStatsDto;

  @ApiProperty({ type: AssetTypeStatsDto })
  byAssetType: AssetTypeStatsDto;

  @ApiProperty({ type: CalibrationStatsDto })
  calibration: CalibrationStatsDto;

  @ApiProperty({ type: WarrantyStatsDto })
  warranty: WarrantyStatsDto;
}

export class AssetListResponseDto {
  @ApiProperty({ type: AssetStatsDto, description: 'Asset statistics' })
  stats: AssetStatsDto;

  @ApiProperty({ type: [Object], description: 'List of assets' })
  records: any[];

  @ApiProperty({ example: 90, description: 'Total number of records matching filters' })
  totalRecords: number;
}
