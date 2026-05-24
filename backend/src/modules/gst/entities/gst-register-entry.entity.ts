import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';

/**
 * GST Register Entry — projected from invoices at approval time (§5.1.13)
 *
 * Sale side: gstType = GST-1 (output tax), no verify flow
 * Purchase side: gstType = GST-3B (input tax), with verify/revert/release flow
 */
@Entity('gst_register_entries')
@Index('IDX_GST_REG_INVOICE', ['invoiceId'], { unique: true })
@Index('IDX_GST_REG_SITE', ['siteId'])
@Index('IDX_GST_REG_PARTY_TYPE', ['partyType'])
@Index('IDX_GST_REG_MONTH', ['invoiceMonth'])
@Index('IDX_GST_REG_FINANCIAL_YEAR', ['financialYear'])
@Index('IDX_GST_REG_PARTY_MONTH', ['partyType', 'invoiceMonth'])
export class GstRegisterEntryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => SiteInvoiceEntity)
  @JoinColumn({ name: 'invoiceId' })
  invoice: SiteInvoiceEntity;

  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  @Column({ type: 'varchar', length: 20 })
  partyType: string; // SALE | PURCHASE

  @Column({ type: 'uuid', nullable: true })
  contractorId: string | null;

  @ManyToOne(() => ContractorEntity, { nullable: true })
  @JoinColumn({ name: 'contractorId' })
  contractor: ContractorEntity | null;

  @Column({ type: 'uuid', nullable: true })
  vendorId: string | null;

  @ManyToOne(() => VendorEntity, { nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: VendorEntity | null;

  // Format: YYYY-MM
  @Column({ type: 'char', length: 7 })
  invoiceMonth: string;

  @Column({ type: 'varchar', length: 10 })
  financialYear: string;

  // GST-1 (sale, output) | GST-3B (purchase, input)
  @Column({ type: 'varchar', length: 10 })
  gstType: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  gstAmount: number;

  // Verification (Purchase side only; Sale stays false per BRD §5)
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null;

  // Optional document attached during verification
  @Column({ type: 'varchar', length: 500, nullable: true })
  verifyFileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verifyFileName: string | null;

  // Optional remarks during verification
  @Column({ type: 'text', nullable: true })
  verifyRemarks: string | null;

  // Set once entry is included in a released GST payment
  @Column({ type: 'uuid', nullable: true })
  gstPaymentId: string | null;
}
