import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class MoveNodeDto {
  @ApiPropertyOptional({
    description: 'Target parent folder ID. Omit or pass null to move to root.',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;
}
