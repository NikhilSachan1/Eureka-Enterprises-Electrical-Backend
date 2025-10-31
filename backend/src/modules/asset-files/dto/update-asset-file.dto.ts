import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateAssetFileDto {
  @ApiProperty({
    description: 'The ID of the asset',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  assetMasterId: string;

  @ApiProperty({
    description: 'The ID of the asset event',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  assetEventsId: string;

  @ApiProperty({
    description: 'The keys of the files in the file storage',
    example: ['asset.jpg', 'asset.png'],
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
