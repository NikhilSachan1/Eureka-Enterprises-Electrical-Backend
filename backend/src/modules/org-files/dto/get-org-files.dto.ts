import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetOrgFilesDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Parent folder ID. Omit to list root level.' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
