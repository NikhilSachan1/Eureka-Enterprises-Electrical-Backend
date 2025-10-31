import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { AssetVersionSortFields } from '../constants/asset-versions.constants';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssetVersionsQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Search by number',
    example: 'AST-001-2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiProperty({
    description: 'Search by brand',
    example: 'Dell',
    required: false,
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({
    description: 'Search by model',
    example: 'Latitude 5420',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    description: 'Search by category',
    example: 'Laptop',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Sort field',
    example: 'createdAt',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(AssetVersionSortFields)
  sortField?: string = AssetVersionSortFields.CREATED_AT;
}
