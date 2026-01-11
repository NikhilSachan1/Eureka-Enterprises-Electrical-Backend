import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GeneratePayrollDto {
  @ApiProperty({
    description: 'User ID (optional - if not provided, generates for all active users)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Month (1-12)', example: 12 })
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ description: 'Year', example: 2024 })
  @IsNumber()
  @Min(2020)
  @Type(() => Number)
  year: number;
}

export class GenerateBulkPayrollDto {
  @ApiProperty({
    description:
      'Array of user IDs to generate payroll for (optional - if not provided, generates for all active users)',
    required: false,
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @ApiProperty({ description: 'Month (1-12)', example: 12 })
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ description: 'Year', example: 2024 })
  @IsNumber()
  @Min(2020)
  @Type(() => Number)
  year: number;
}
