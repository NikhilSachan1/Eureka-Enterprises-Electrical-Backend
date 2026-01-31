import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for invoice aging report request
 * Returns aging analysis of invoices grouped by days overdue
 */
export class GetInvoiceAgingDto {
  @ApiProperty({
    description:
      'Document direction - RECEIVABLE for income (from clients), PAYABLE for expenses (to vendors)',
    example: 'RECEIVABLE',
    enum: ['RECEIVABLE', 'PAYABLE'],
  })
  @IsString()
  direction: 'RECEIVABLE' | 'PAYABLE';

  @ApiPropertyOptional({
    description: 'Filter by site ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({
    description: 'Filter by contractor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @ApiPropertyOptional({
    description: 'Include only overdue invoices (past due date)',
    example: true,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
