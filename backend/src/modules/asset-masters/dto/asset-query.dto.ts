import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { AssetMasterSortFields } from '../constants/asset-masters.constants';

export class AssetQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Search by registration number',
    example: 'AST-001-2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  registrationNo?: string;

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
  @IsEnum(AssetMasterSortFields)
  sortField?: string = AssetMasterSortFields.CREATED_AT;
}
