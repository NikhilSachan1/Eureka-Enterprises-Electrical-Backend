import { IsNotEmpty, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeallocateSiteDto {
  @ApiProperty({
    description: 'Date when deallocation occurred (ISO date string)',
    example: '2024-01-20',
  })
  @IsNotEmpty()
  @IsDateString()
  deallocatedAt: string;

  @ApiPropertyOptional({ description: 'Reason for deallocation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
