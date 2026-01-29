import { Entity, Column, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Entity('dsr_edit_history')
@Index('IDX_DSR_EDIT_HISTORY_DSR', ['dsrId'])
@Index('IDX_DSR_EDIT_HISTORY_EDITED_BY', ['editedBy'])
@Index('IDX_DSR_EDIT_HISTORY_EDITED_AT', ['editedAt'])
export class DsrEditHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // DSR reference
  @Column({ type: 'uuid' })
  dsrId: string;

  @ManyToOne('DailyStatusReportEntity', 'editHistory', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dsrId' })
  dsr: any;

  // Who edited
  @Column({ type: 'uuid' })
  editedBy: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'editedBy' })
  editedByUser: UserEntity;

  // When edited
  @Column({ type: 'timestamp', default: () => 'NOW()' })
  editedAt: Date;

  // What was changed (only changed fields)
  @Column({ type: 'jsonb' })
  previousValues: Record<string, any>;

  @Column({ type: 'jsonb' })
  newValues: Record<string, any>;

  // Optional reason for the change
  @Column({ type: 'text', nullable: true })
  changeReason: string;
}
