import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsUUID, IsArray, IsIn, IsInt, Min } from 'class-validator';

export class GetPaymentRequestDto {
  @ApiPropertyOptional({ type: [String], description: 'Filter by site IDs' })
  @Transform(({ value }) => (Array.isArray(value) ? value : value != null ? [value] : undefined))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  siteId?: string[];

  @ApiPropertyOptional({ description: 'Filter by invoice' })
  @IsOptional()
  @IsUUID('4')
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}
