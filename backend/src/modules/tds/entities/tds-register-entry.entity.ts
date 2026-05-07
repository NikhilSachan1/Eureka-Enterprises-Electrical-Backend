import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';

/**
 * TDS Register Entry — projected from invoices at approval time (§5.1.15)
 * Applies to BOTH SALE and PURCHASE sides.
 */
@Entity('tds_register_entries')
@Index('IDX_TDS_REG_INVOICE', ['invoiceId'], { unique: true })
@Index('IDX_TDS_REG_SITE', ['siteId'])
@Index('IDX_TDS_REG_PARTY_TYPE', ['partyType'])
@Index('IDX_TDS_REG_MONTH', ['invoiceMonth'])
@Index('IDX_TDS_REG_FINANCIAL_YEAR', ['financialYear'])
export class TdsRegisterEntryEntity extends BaseEntity {
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

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  tdsAmount: number;

  // Verification
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null;

  // Set once entry is included in a TDS payment
  @Column({ type: 'uuid', nullable: true })
  tdsPaymentId: string | null;
}
