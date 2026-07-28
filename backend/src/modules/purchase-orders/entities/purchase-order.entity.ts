import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import {
  FinancialApprovalStatus,
  PartyType,
} from 'src/modules/common/financials/financial.constants';
import { PoItemEntity } from './po-item.entity';

@Entity('purchase_orders')
@Index('IDX_PO_SITE', ['siteId'])
@Index('IDX_PO_PARTY_TYPE', ['partyType'])
@Index('IDX_PO_CONTRACTOR', ['contractorId'])
@Index('IDX_PO_VENDOR', ['vendorId'])
@Index('IDX_PO_NUMBER', ['poNumber'])
@Index('IDX_PO_APPROVAL_STATUS', ['approvalStatus'])
@Index('IDX_PO_SITE_PARTY', ['siteId', 'partyType'])
@Index('IDX_PO_LISTING', ['siteId', 'partyType', 'approvalStatus'])
export class PurchaseOrderEntity extends BaseEntity {
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
  poNumber: string;

  @Column({ type: 'date' })
  poDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  gstPercentage: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number;

  // Attachment (BRD §4.1 — required)
  // Nullable: system-generated POs have no uploaded scan (generated + approved + downloaded).
  @Column({ type: 'varchar', length: 500, nullable: true })
  fileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  // True when created via the generate flow (has line items). Upload-based POs stay false.
  @Column({ type: 'boolean', default: false })
  isSystemGenerated: boolean;

  // Tax split shown on the generated PDF: 'CGST_SGST' (intra-state) or 'IGST' (inter-state).
  @Column({ type: 'varchar', length: 10, default: 'CGST_SGST' })
  gstType: string;

  // Terms & Conditions printed on the PO (pre-filled from the default template, editable).
  @Column({ type: 'text', nullable: true })
  termsAndConditions: string | null;

  @OneToMany(() => PoItemEntity, (item) => item.po)
  items: PoItemEntity[];

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Approval workflow
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

  // Lock / unlock-request flow (BRD §7.3)
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

  // Denormalized rollup columns (maintained transactionally)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  invoicedTotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  bookedTotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paidTotal: number;

  @Column({ type: 'timestamp', nullable: true })
  lastInvoiceAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastPaymentAt: Date | null;
}

// Re-export shared types so consumers of this module can resolve them in one import
export { PartyType, FinancialApprovalStatus };
