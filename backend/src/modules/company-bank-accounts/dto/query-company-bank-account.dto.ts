import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryCompanyBankAccountDto {
  @ApiPropertyOptional({ description: 'Filter by active/inactive' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by account name, bank name, or account number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @Transform(({ value }) => (value !== undefined ? parseInt(value) : undefined))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Omit to return all records' })
  @Transform(({ value }) => (value !== undefined ? parseInt(value) : undefined))
  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}
