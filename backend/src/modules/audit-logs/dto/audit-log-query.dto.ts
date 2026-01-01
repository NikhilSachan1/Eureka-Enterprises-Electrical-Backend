import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsInt, IsEnum, Min, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';
import { EntityAuditAction } from '../entities/entity-audit-log.entity';

export class RequestAuditLogQueryDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by correlation ID' })
  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by HTTP method' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  method?: string;

  @ApiPropertyOptional({ description: 'Filter by URL (partial match)' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Filter by response status code' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  responseStatus?: number;

  @ApiPropertyOptional({ description: 'Filter by minimum response status' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minStatus?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum response status' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxStatus?: number;

  @ApiPropertyOptional({ description: 'Filter from date (ISO string)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO string)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Filter by error only (status >= 400)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  errorsOnly?: boolean;
}

export class EntityAuditLogQueryDto extends BaseGetDto {
  @ApiPropertyOptional({ description: 'Filter by correlation ID' })
  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Filter by entity name' })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by action', enum: EntityAuditAction })
  @IsOptional()
  @IsEnum(EntityAuditAction)
  action?: EntityAuditAction;

  @ApiPropertyOptional({ description: 'Filter by user who made change' })
  @IsOptional()
  @IsUUID()
  changedBy?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO string)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO string)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CleanupAuditLogsDto {
  @ApiPropertyOptional({
    description: 'Delete logs older than this many days',
    default: 90,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number = 90;
}
