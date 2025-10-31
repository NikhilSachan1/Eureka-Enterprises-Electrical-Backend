import { IsNotEmpty, IsOptional, IsObject, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({
    description: 'Asset master id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  assetMasterId: string;

  @ApiProperty({ description: 'Asset number', example: 'AST-001-2024' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ description: 'Asset brand', example: 'Dell' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ description: 'Asset model', example: 'Latitude 5420' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ description: 'Asset category', example: 'Laptop' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Additional data',
    example: { serialNumber: 'SN123456', purchaseDate: '2024-01-01' },
  })
  @IsOptional()
  @IsObject()
  additionalData: Record<string, any>;

  @ApiProperty({
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: true,
  })
  assetFiles: any;
}
