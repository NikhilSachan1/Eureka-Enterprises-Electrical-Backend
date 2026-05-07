import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RejectDto {
  @ApiProperty({ description: 'Rejection reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ApproveDto {
  @ApiPropertyOptional({ description: 'Optional approval note' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reason?: string;
}

export class UnlockRequestDto {
  @ApiProperty({ description: 'Reason for requesting unlock' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
