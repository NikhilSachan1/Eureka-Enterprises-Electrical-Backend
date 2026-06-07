import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum DocumentStatusPartyType {
  SALE     = 'SALE',
  PURCHASE = 'PURCHASE',
}

export class GetDocumentStatusDto {
  /**
   * One or more site IDs to include in the summary.
   * Accepts ?siteId[]=uuid1&siteId[]=uuid2
   */
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  siteId: string[];

  /**
   * Optionally restrict to sites belonging to these companies.
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  companyId?: string[];

  /**
   * Filter to a single party side. If omitted, both SALE and PURCHASE are returned.
   */
  @IsOptional()
  @IsEnum(DocumentStatusPartyType)
  partyType?: DocumentStatusPartyType;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 10;
}
