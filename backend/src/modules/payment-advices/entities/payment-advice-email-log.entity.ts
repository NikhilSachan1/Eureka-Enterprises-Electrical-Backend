import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PaymentAdviceEntity } from './payment-advice.entity';

/**
 * Email log for payment advice sends (§5.1.10)
 * BRD §4.7 — emailing the advice is a manual user action with To/CC/Body/Attachments.
 */
@Entity('payment_advice_email_logs')
@Index('IDX_PA_EMAIL_LOG_ADVICE', ['paymentAdviceId'])
export class PaymentAdviceEmailLogEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  paymentAdviceId: string;

  @ManyToOne(() => PaymentAdviceEntity)
  @JoinColumn({ name: 'paymentAdviceId' })
  paymentAdvice: PaymentAdviceEntity;

  @Column({ type: 'jsonb' })
  toEmails: string[];

  @Column({ type: 'jsonb', nullable: true })
  ccEmails: string[] | null;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  attachmentKeys: string[] | null;

  // Links to existing communication_logs for retry tracking
  @Column({ type: 'uuid', nullable: true })
  communicationLogId: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  sentAt: Date;
}
