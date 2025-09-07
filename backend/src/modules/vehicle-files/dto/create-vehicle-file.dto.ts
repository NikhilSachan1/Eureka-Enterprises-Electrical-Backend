import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVehicleFileDto {
  @ApiProperty({
    description: 'The ID of the vehicle',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({
    description: 'The ID of the vehicle event',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleEventsId: string;

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
    example: 'image',
  })
  @IsNotEmpty()
  @IsString()
  fileType: string;

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
