import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CurrentStatusQueryDto {
  @ApiProperty({
    description: 'The user ID to get current status for (only for HR, ADMIN, SUPER_ADMIN)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  userId?: string;
}
