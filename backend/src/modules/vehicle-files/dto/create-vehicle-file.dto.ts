import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVehicleFileDto {
  @ApiProperty({
    description: 'The ID of the vehicle',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleMasterId: string;

  @ApiProperty({
    description: 'The ID of the vehicle version',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  vehicleVersionId?: string;

  @ApiProperty({
    description: 'The ID of the vehicle event',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  vehicleEventsId?: string;

  @ApiProperty({
    description: 'The keys of the files in the file storage',
    example: ['car.jpg', 'car.png'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileKeys: string[];

  @ApiProperty({
    description: 'The type of the file',
    example: 'VEHICLE_IMAGE',
  })
  @IsNotEmpty()
  @IsString()
  fileType: string;

  @ApiProperty({
    description: 'Label/description for the file',
    example: 'Front view of vehicle',
    required: false,
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: true,
  })
  @IsOptional()
  files?: any;
}
