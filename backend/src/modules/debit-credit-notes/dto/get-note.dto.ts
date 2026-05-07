import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { NoteSide } from 'src/modules/common/financials/financial.constants';

export class GetNoteDto {
  @ApiProperty({ enum: NoteSide, description: 'SALE for debit notes, PURCHASE for credit notes' })
  @IsEnum(NoteSide)
  noteSide: NoteSide;

  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by contractor ID (for SALE side)' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor ID (for PURCHASE side)' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Search by remarks' })
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
