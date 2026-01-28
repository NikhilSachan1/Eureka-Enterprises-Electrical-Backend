import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetSiteDocumentDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Search by document number' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by contractor ID' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Filter by document type' })
  @IsString()
  @IsOptional()
  documentType?: string;

  @ApiPropertyOptional({ description: 'Filter by direction (PAYABLE or RECEIVABLE)' })
  @IsString()
  @IsOptional()
  direction?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by payment status' })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Filter by document date from' })
  @IsDateString()
  @IsOptional()
  documentDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by document date to' })
  @IsDateString()
  @IsOptional()
  documentDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by due date from' })
  @IsDateString()
  @IsOptional()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by due date to' })
  @IsDateString()
  @IsOptional()
  dueDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter overdue documents only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  overdueOnly?: boolean;

  @ApiPropertyOptional({ description: 'Include site details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSite?: boolean;

  @ApiPropertyOptional({ description: 'Include contractor details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeContractor?: boolean;
}
