import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetPaymentAdviceDto {
  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Filter by financial year (e.g., "2526")' })
  @IsString()
  @IsOptional()
  financialYear?: string;

  @ApiPropertyOptional({ description: 'Search by reference number' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortField?: string;

  @ApiPropertyOptional({ description: 'Sort order (ASC/DESC)', default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}
