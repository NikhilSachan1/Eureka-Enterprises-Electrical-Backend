import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RevertEntryDto {
  @ApiProperty({ description: 'Reason for reverting the verification' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
