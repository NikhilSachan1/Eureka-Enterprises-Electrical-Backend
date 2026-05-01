import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ description: 'Folder name', example: 'Policies' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Parent folder ID. Omit to create at root level.' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
