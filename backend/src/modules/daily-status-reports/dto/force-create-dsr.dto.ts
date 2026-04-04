import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { CreateDsrDto } from './create-dsr.dto';

export class ForceCreateDsrDto extends CreateDsrDto {
  @ApiPropertyOptional({
    description:
      'User this DSR is recorded for. Omit to use the authenticated user. Setting another user requires SUPER_ADMIN, HR, ADMIN, or MANAGER.',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId?: string;
}
