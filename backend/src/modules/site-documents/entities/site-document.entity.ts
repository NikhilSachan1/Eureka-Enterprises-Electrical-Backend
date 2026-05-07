import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { SiteDocumentStatus } from '../constants/site-document.constants';

/**
 * Site Document Entity - Repurposed for non-financial documents only.
 * 
 * Financial documents (PO, INVOICE) have been moved to dedicated modules:
 * - purchase_orders, site_invoices, bank_transfers, etc.
 * 
 * This entity now handles miscellaneous site documents like:
 * - Contracts, work orders, completion certificates
 * - Photos, inspection reports, etc.
 */
@Entity('site_documents')
@Index('IDX_SITE_DOCUMENT_SITE', ['siteId'])
@Index('IDX_SITE_DOCUMENT_CONTRACTOR', ['contractorId'])
@Index('IDX_SITE_DOCUMENT_VENDOR', ['vendorId'])
@Index('IDX_SITE_DOCUMENT_TYPE', ['documentType'])
@Index('IDX_SITE_DOCUMENT_STATUS', ['status'])
@Index('IDX_SITE_DOCUMENT_NUMBER', ['documentNumber'])
export class SiteDocumentEntity extends BaseEntity {
  // Site reference
  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  // Contractor reference (nullable for site-level documents or vendor documents)
  @Column({ type: 'uuid', nullable: true })
  contractorId: string | null;

  @ManyToOne(() => ContractorEntity, { nullable: true })
  @JoinColumn({ name: 'contractorId' })
  contractor: ContractorEntity | null;

  // Vendor reference (nullable - for vendor-related non-financial documents)
  @Column({ type: 'uuid', nullable: true })
  vendorId: string | null;

  @ManyToOne(() => VendorEntity, { nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: VendorEntity | null;

  // Document type (CONTRACT, WORK_ORDER, COMPLETION_CERTIFICATE, PHOTO, etc.)
  // PO and INVOICE are no longer allowed - use dedicated financial modules
  @Column({ type: 'varchar', length: 50 })
  documentType: string;

  // Document number (optional for informal docs like photos)
  @Column({ type: 'varchar', length: 100, nullable: true })
  documentNumber: string | null;

  // Document date
  @Column({ type: 'date' })
  documentDate: Date;

  // Amount - kept for informational "rough quote" purposes only (nullable)
  // Not used for financial calculations - those are in dedicated modules
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount: number | null;

  // File details
  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  // Document status - simplified: DRAFT | APPROVED | REJECTED
  @Column({ type: 'varchar', length: 20, default: SiteDocumentStatus.DRAFT })
  status: string;

  // Remarks/notes
  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}
