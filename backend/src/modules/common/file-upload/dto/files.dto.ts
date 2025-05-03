import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class FileUploadDto {
  @ApiProperty({
    description: 'File to be uploaded.',
    type: 'string',
    format: 'binary',
    required: true,
  })
  @IsNotEmpty()
  file: any;
}
