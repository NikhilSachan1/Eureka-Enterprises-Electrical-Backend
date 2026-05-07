import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Helper table for GST payment advice sequence allocation (§5.1.14a)
 */
@Entity('gst_payment_advice_sequences')
export class GstPaymentAdviceSequenceEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  financialYear: string;

  @Column({ type: 'integer', default: 0 })
  lastSeq: number;
}
