import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DocumentStatusPartyType } from './get-document-status.dto';

/**
 * Query for the PO-wise document breakdown (drill-down tree):
 * PO → JMC → Report / Invoice → Book Payment → Bank Transfer.
 * Pagination applies at the PO level; everything under each PO is fully nested.
 */
export class GetPoBreakdownDto {
  /** One or more site IDs. Accepts ?siteId[]=uuid1&siteId[]=uuid2 */
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  siteId: string[];

  /** Optionally restrict to sites belonging to these companies. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  companyId?: string[];

  /** Optionally restrict to specific PO(s). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  poId?: string[];

  /** Filter to a single party side. If omitted, both SALE and PURCHASE are returned. */
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
