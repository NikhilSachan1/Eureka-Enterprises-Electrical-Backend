import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * TDS Payment — both SALE and PURCHASE sides, monthly release (§5.1.16)
 * No payment advice reference generated (BRD §11 confirmed-7).
 */
@Entity('tds_payments')
@Index('IDX_TDS_PAYMENT_SITE', ['siteId'])
@Index('IDX_TDS_PAYMENT_PARTY_TYPE', ['partyType'])
@Index('IDX_TDS_PAYMENT_MONTH', ['paymentMonth'])
export class TdsPaymentEntity extends BaseEntity {
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
  paymentMonth: string;

  @Column({ type: 'varchar', length: 10 })
  financialYear: string;

  // Sum of TDS on verified entries for the month
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  netAmount: number;

  @Column({ type: 'varchar', length: 100 })
  utrNumber: string;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.APPROVED })
  approvalStatus: string;
}
