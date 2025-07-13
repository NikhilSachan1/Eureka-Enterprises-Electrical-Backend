import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetLeaveBalanceDto {
  @ApiProperty({
    description: 'financial year',
    example: '2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  financialYear: string;
}
