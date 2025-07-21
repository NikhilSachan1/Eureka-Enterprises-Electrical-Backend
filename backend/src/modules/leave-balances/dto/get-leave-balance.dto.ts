import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetLeaveBalanceDto {
  @ApiProperty({
    description: 'financial year',
    example: '2025-2026',
    required: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  financialYear: string;
}
