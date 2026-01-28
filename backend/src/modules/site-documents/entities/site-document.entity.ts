import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import {
  SiteDocumentStatus,
  SiteDocumentPaymentStatus,
} from '../constants/site-document.constants';

@Entity('site_documents')
@Index('IDX_SITE_DOCUMENT_SITE', ['siteId'])
@Index('IDX_SITE_DOCUMENT_CONTRACTOR', ['contractorId'])
@Index('IDX_SITE_DOCUMENT_TYPE', ['documentType'])
@Index('IDX_SITE_DOCUMENT_DIRECTION', ['direction'])
@Index('IDX_SITE_DOCUMENT_STATUS', ['status'])
@Index('IDX_SITE_DOCUMENT_PAYMENT_STATUS', ['paymentStatus'])
@Index('IDX_SITE_DOCUMENT_NUMBER', ['documentNumber'])
@Index('IDX_SITE_DOCUMENT_DUE_DATE', ['dueDate'])
export class SiteDocumentEntity extends BaseEntity {
  // Site reference
  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  // Contractor reference (nullable for site-level documents)
  @Column({ type: 'uuid', nullable: true })
  contractorId: string;

  @ManyToOne(() => ContractorEntity)
  @JoinColumn({ name: 'contractorId' })
  contractor: ContractorEntity;

  // Document type (PO, INVOICE, CONTRACT, etc.) - config driven
  @Column({ type: 'varchar', length: 50 })
  documentType: string;

  // Document direction for profitability (PAYABLE = expense, RECEIVABLE = income)
  // Nullable for non-financial documents (completion certificates, photos, etc.)
  @Column({ type: 'varchar', length: 20, nullable: true })
  direction: string;

  // Document number (PO number, Invoice number, etc.) - optional for informal docs
  @Column({ type: 'varchar', length: 100, nullable: true })
  documentNumber: string;

  // Document date
  @Column({ type: 'date' })
  documentDate: Date;

  // Amount details
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  // File details
  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  // Document status - config driven
  @Column({ type: 'varchar', length: 20, default: SiteDocumentStatus.DRAFT })
  status: string;

  // Payment status - config driven
  @Column({ type: 'varchar', length: 20, default: SiteDocumentPaymentStatus.PENDING })
  paymentStatus: string;

  // Payment details
  @Column({ type: 'date', nullable: true })
  paymentDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentReference: string;

  // Due date for payment
  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  // Remarks/notes
  @Column({ type: 'text', nullable: true })
  remarks: string;
}
