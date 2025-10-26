import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateVehicleDto {
  @ApiProperty({
    description: 'The registration number of the vehicle',
    example: '1234567890',
  })
  @IsNotEmpty()
  @IsString()
  registrationNo: string;

  @ApiProperty({ description: 'Vehicle number', example: 'MP01KK2345' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ description: 'Vehicle brand', example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ description: 'Vehicle model', example: 'Fortuner' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ description: 'Vehicle mileage', example: '23' })
  @IsString()
  @IsNotEmpty()
  mileage: string;

  @ApiProperty({
    description: 'Additional data',
    example: { color: 'Red', year: 2020 },
  })
  @IsOptional()
  @IsObject()
  additionalData: Record<string, any>;
}
