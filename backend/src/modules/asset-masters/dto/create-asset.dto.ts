import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset Registration No', example: 'AST-001-2024' })
  @IsString()
  @IsNotEmpty()
  registrationNo: string;

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
