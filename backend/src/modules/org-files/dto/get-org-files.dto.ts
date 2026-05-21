import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsIn, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetOrgFilesDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Parent folder ID. Omit to list root level.' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by type: file or folder',
    enum: ['file', 'folder'],
  })
  @IsIn(['file', 'folder'])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Search by file or folder name (partial, case-insensitive)' })
  @IsString()
  @IsOptional()
  search?: string;
}
