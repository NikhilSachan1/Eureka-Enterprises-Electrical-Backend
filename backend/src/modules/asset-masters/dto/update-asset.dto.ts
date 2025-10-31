import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateAssetDto {
  @ApiProperty({
    description: 'The registration number of the asset',
    example: '1234567890',
  })
  @IsNotEmpty()
  @IsString()
  registrationNo: string;

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
}
