import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Helper table for advisory-lock based sequence allocation (§5.1.9a)
 * Stores the last used sequence number per financial year.
 */
@Entity('payment_advice_sequences')
export class PaymentAdviceSequenceEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  financialYear: string;

  @Column({ type: 'integer', default: 0 })
  lastSeq: number;
}
