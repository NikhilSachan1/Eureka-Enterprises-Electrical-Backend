import { Entity, Column, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { AdvancePaymentEntity } from './advance-payment.entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

/**
 * One row per "this invoice consumed this much of this advance".
 *
 * Many-to-many in both directions, which is why it is a table and not a column: one advance can be
 * consumed by several invoices, and one invoice can draw on several advances when no single advance
 * covers it.
 *
 * It is also the only record of *which* invoice consumed the money —
 * `AdvancePaymentEntity.settledAmount` is a cached sum and cannot answer that.
 *
 * Rows are written when an invoice is APPROVED and deleted if that approval is reversed
 * (rejected / unlocked), which is what gives the advance balance back.
 *
 * Does not extend BaseEntity: settlements are immutable facts, never edited and never soft-deleted
 * — a reversal removes the row outright, so updatedBy / deletedAt would only ever be noise.
 */
@Entity('advance_settlements')
@Index('IDX_ADVANCE_SETTLEMENTS_ADVANCE', ['advancePaymentId'])
@Index('IDX_ADVANCE_SETTLEMENTS_INVOICE', ['invoiceId'])
@Index('UQ_ADVANCE_SETTLEMENT_PAIR', ['advancePaymentId', 'invoiceId'], { unique: true })
export class AdvanceSettlementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  advancePaymentId: string;

  @ManyToOne(() => AdvancePaymentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'advancePaymentId' })
  advancePayment: AdvancePaymentEntity;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => SiteInvoiceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: SiteInvoiceEntity;

  /** How much of the advance this invoice consumed. Always > 0 (DB CHECK). */
  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  settledAt: Date;

  /** The approver whose invoice approval triggered this settlement. */
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity | null;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}
