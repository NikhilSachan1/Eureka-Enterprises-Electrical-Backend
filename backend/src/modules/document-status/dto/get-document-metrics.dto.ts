import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocumentStatusPartyType } from './get-document-status.dto';

/** Document types the metrics cover; a tab asks for its own through `doc`. */
export enum DocumentMetricsDoc {
  PO = 'po',
  JMC = 'jmc',
  REPORT = 'report',
  INVOICE = 'invoice',
  BOOK_PAYMENT = 'bookPayment',
  ADVANCE = 'advance',
  GST = 'gst',
  TDS = 'tds',
}

/**
 * Filters for the document metrics. All optional: with none, the metrics cover every site the
 * user can read; each filter narrows them the same way it narrows the document lists.
 */
export class GetDocumentMetricsDto {
  /** Only this document's metrics (one tab); all of them when omitted. */
  @IsOptional()
  @IsEnum(DocumentMetricsDoc)
  doc?: DocumentMetricsDoc;

  /** Accepts ?siteId[]=uuid1&siteId[]=uuid2 */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  siteId?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  companyId?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  contractorId?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  vendorId?: string[];

  /** SALE (contractor) or PURCHASE (vendor). */
  @IsOptional()
  @IsEnum(DocumentStatusPartyType)
  partyType?: DocumentStatusPartyType;

  /** Document date from (inclusive), YYYY-MM-DD. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Document date to (inclusive), YYYY-MM-DD. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
