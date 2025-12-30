import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAssetFileDto {
  @ApiProperty({
    description: 'The ID of the asset',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  assetMasterId: string;

  @ApiProperty({
    description: 'The ID of the asset version',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assetVersionId?: string;

  @ApiProperty({
    description: 'The ID of the asset event',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  assetEventsId?: string;

  @ApiProperty({
    description: 'The keys of the files in the file storage',
    example: ['asset.jpg', 'asset.png'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileKeys: string[];

  @ApiProperty({
    description:
      'The type of the file (from config: ASSET_IMAGE, CALIBRATION_CERTIFICATE, WARRANTY_DOCUMENT, PURCHASE_INVOICE, AMC, REPAIR_REPORT, OTHER)',
    example: 'CALIBRATION_CERTIFICATE',
  })
  @IsNotEmpty()
  @IsString()
  fileType: string;

  @ApiProperty({
    description: 'Optional label/description for the file',
    example: 'Calibration certificate Aug 2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiProperty({
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  files?: any;
}
