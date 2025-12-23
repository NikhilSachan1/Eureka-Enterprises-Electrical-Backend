import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVehicleServiceFileDto {
  @ApiProperty({
    description: 'Vehicle service ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleServiceId: string;

  @ApiProperty({
    description: 'File keys from storage',
    example: ['invoice.pdf', 'bill.pdf'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileKeys?: string[];

  @ApiProperty({
    description: 'File type',
    example: 'INVOICE',
  })
  @IsNotEmpty()
  @IsString()
  fileType: string;

  @ApiPropertyOptional({
    description: 'Label/description for the file',
    example: 'Service Invoice - Dec 2024',
  })
  @IsOptional()
  @IsString()
  label?: string;
}
