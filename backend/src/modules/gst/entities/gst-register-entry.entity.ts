import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { GstPaymentEntity } from './gst-payment.entity';

/**
 * GST Register Entry — projected from invoices at approval time (§5.1.13)
 *
 * Sale side: gstType = GST-1 (output tax). Verify = our GSTR-1 reflects the invoice.
 *   Held GST is withheld by the client and later RECEIVED from them.
 * Purchase side: gstType = GST-3B (input tax). Verify = invoice appears in our GSTR-2B.
 *   Held GST is withheld by us and RELEASED to the vendor once verified.
 *
 * Every entry is created pending — portal verification applies whether or not GST was held.
 * Only held entries are settled (gstPaymentId); un-held GST moved with the invoice payment.
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

  // Snapshot of invoice.isGstHold at approval. true → amount is settled via the GST register.
  @Column({ type: 'boolean', default: true })
  isGstHold: boolean;

  // Portal verification (GSTR-2B for purchase, GSTR-1 for sale)
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'verifiedBy' })
  verifiedByUser: UserEntity | null;

  // Revert reason (set when verification is reverted)
  @Column({ type: 'text', nullable: true })
  revertReason: string | null;

  // Optional document attached during verification
  @Column({ type: 'varchar', length: 500, nullable: true })
  verifyFileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verifyFileName: string | null;

  // Optional remarks during verification
  @Column({ type: 'text', nullable: true })
  verifyRemarks: string | null;

  // Set once the held GST is settled (released to vendor / received from client)
  @Column({ type: 'uuid', nullable: true })
  gstPaymentId: string | null;

  @ManyToOne(() => GstPaymentEntity, { nullable: true })
  @JoinColumn({ name: 'gstPaymentId' })
  gstPayment: GstPaymentEntity | null;
}
