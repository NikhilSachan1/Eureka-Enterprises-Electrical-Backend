import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PurchaseOrderEntity } from 'src/modules/purchase-orders/entities/purchase-order.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

@Entity('jmcs')
@Index('IDX_JMC_PO', ['poId'])
@Index('IDX_JMC_SITE', ['siteId'])
@Index('IDX_JMC_PARTY_TYPE', ['partyType'])
@Index('IDX_JMC_APPROVAL_STATUS', ['approvalStatus'])
@Index('IDX_JMC_SITE_PARTY', ['siteId', 'partyType'])
@Index('IDX_JMC_LISTING', ['siteId', 'partyType', 'approvalStatus'])
export class JmcEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  poId: string;

  @ManyToOne(() => PurchaseOrderEntity)
  @JoinColumn({ name: 'poId' })
  po: PurchaseOrderEntity;

  // Denormalized for fast filtering — immutable for the JMC's lifetime
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

  @Column({ type: 'varchar', length: 100 })
  jmcNumber: string;

  @Column({ type: 'date' })
  jmcDate: Date;

  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Approval
  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.PENDING })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity | null;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date | null;

  @Column({ type: 'text', nullable: true })
  approvalReason: string | null;

  // Lock / unlock
  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  unlockRequestedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  unlockRequestedBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'unlockRequestedBy' })
  unlockRequestedByUser: UserEntity | null;

  @Column({ type: 'text', nullable: true })
  unlockReason: string | null;
}
