import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OverallStatus } from '../constants/document-status.constants';

export enum IssuesSortField {
  JMC_DATE    = 'jmcDate',
  JMC_NUMBER  = 'jmcNumber',
  PARTY_NAME  = 'partyName',
  SITE_NAME   = 'siteName',
}

export enum SortOrder {
  ASC  = 'ASC',
  DESC = 'DESC',
}

export class GetDocumentIssuesDto {
  /**
   * One or more site IDs. Accepts ?siteId[]=uuid1&siteId[]=uuid2
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
   * Filter to SALE or PURCHASE side.
   */
  @IsOptional()
  @IsEnum({ SALE: 'SALE', PURCHASE: 'PURCHASE' })
  partyType?: string;

  /**
   * Filter to one or more specific overall statuses.
   * e.g. ?overallStatus[]=REPORT_MISSING&overallStatus[]=INVOICE_PENDING
   */
  @IsOptional()
  @IsArray()
  @IsEnum(OverallStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  overallStatus?: OverallStatus[];

  /**
   * When true, COMPLETE chains are included in results.
   * Default: false (only show chains with issues).
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeComplete?: boolean = false;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(IssuesSortField)
  sortField?: IssuesSortField = IssuesSortField.JMC_DATE;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;
}
