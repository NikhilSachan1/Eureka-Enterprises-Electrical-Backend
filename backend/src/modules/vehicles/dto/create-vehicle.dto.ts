import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleDto {
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
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: true,
  })
  vehicleFiles: any;
}
