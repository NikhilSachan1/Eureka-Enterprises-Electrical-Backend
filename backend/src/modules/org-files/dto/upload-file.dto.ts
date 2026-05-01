import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({
    description: 'File to upload',
    type: 'string',
    format: 'binary',
  })
  orgFiles: any;

  @ApiPropertyOptional({ description: 'Parent folder ID. Omit to upload at root level.' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
