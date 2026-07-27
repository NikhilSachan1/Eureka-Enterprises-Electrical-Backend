import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

/**
 * A project-wise request to pay against an invoice. On approval (optionally with an adjusted
 * amount) a book_payment is created for the approved amount and linked via `bookPaymentId`.
 */
@Entity('payment_requests')
@Index('IDX_PAYMENT_REQUESTS_INVOICE', ['invoiceId'])
@Index('IDX_PAYMENT_REQUESTS_SITE_STATUS', ['siteId', 'status'])
export class PaymentRequestEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => SiteInvoiceEntity)
  @JoinColumn({ name: 'invoiceId' })
  invoice: SiteInvoiceEntity;

  // Denormalized for project-wise filtering — immutable for the request's lifetime.
  @Column({ type: 'uuid' })
  siteId: string;

  @Column({ type: 'uuid' })
  poId: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  requestedAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  approvedAmount: number | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string; // PENDING | APPROVED | REJECTED

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  // The book_payment created when this request is approved.
  @Column({ type: 'uuid', nullable: true })
  bookPaymentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvalAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;
}
