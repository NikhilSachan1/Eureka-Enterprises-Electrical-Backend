import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameNodeDto {
  @ApiProperty({ description: 'New name', example: 'HR Policies 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
