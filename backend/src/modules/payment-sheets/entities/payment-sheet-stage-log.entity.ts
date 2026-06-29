import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

/**
 * Header-level workflow trail — one row per stage transition (submit / forward /
 * return / reject / complete).
 */
@Entity('payment_sheet_stage_logs')
@Index('IDX_PS_STAGE_LOG_SHEET', ['paymentSheetId'])
export class PaymentSheetStageLogEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  paymentSheetId: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  fromStage: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  toStage: string | null;

  @Column({ type: 'varchar', length: 20 })
  action: string; // StageAction

  @Column({ type: 'uuid', nullable: true })
  actedBy: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actedRole: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}
