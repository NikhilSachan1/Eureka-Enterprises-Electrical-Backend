import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PurchaseOrderEntity } from 'src/modules/purchase-orders/entities/purchase-order.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * Advance Payment — PURCHASE side only.
 *
 * Money paid to a vendor against a PO **before** they raise a JMC/invoice. The whole PURCHASE
 * chain otherwise begins at an invoice, so without this there is no document for pre-invoice money
 * to hang off. Once the vendor does invoice, the advance is consumed automatically on invoice
 * approval (see AdvanceSettlementEntity).
 *
 * Carries no tax split at all — a single final `amount`, no GST/TDS, and nothing from it reaches
 * the GST register.
 */
@Entity('advance_payments')
@Index('IDX_ADVANCE_PAYMENTS_poId', ['poId'])
@Index('IDX_ADVANCE_PAYMENTS_siteId', ['siteId'])
@Index('IDX_ADVANCE_PAYMENTS_vendorId', ['vendorId'])
@Index('IDX_ADVANCE_PAYMENTS_approvalStatus', ['approvalStatus'])
export class AdvancePaymentEntity extends BaseEntity {
  /** Auto-generated, e.g. ADV-10001. Format from the `advance_number_config` config. */
  @Column({ type: 'varchar', length: 30 })
  advanceNumber: string;

  /**
   * The vendor's own reference for the advance. Optional by design — many vendors do not issue
   * one, and the user was explicit that this must not block recording the payment.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  vendorAdvanceNumber: string | null;

  @Column({ type: 'uuid' })
  poId: string;

  @ManyToOne(() => PurchaseOrderEntity)
  @JoinColumn({ name: 'poId' })
  po: PurchaseOrderEntity;

  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  @Column({ type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => VendorEntity)
  @JoinColumn({ name: 'vendorId' })
  vendor: VendorEntity;

  @Column({ type: 'date' })
  advanceDate: Date;

  /** Single final amount. No taxable/GST/TDS breakdown exists for an advance. */
  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount: number;

  /**
   * How much of this advance invoices have consumed so far. A cached sum of advance_settlements —
   * those rows stay the source of truth, mirroring how purchase_orders caches its own totals.
   * `amount - settledAmount` is the balance still available to future invoices.
   */
  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  settledAmount: number;

  /** The vendor's temporary / "kind of" invoice that justified paying in advance. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  fileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  /** Mirrors PO / JMC / Invoice. Only an APPROVED advance can be booked or settled. */
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
  rejectionReason: string | null;

  /**
   * Set when a book payment is raised against this advance. Together with `settledAmount > 0` it
   * is what locks the advance against edit and delete — once money has moved or been reconciled,
   * changing the record would desynchronise the rollups.
   */
  @Column({ type: 'boolean', default: false })
  hasBookPayment: boolean;
}
