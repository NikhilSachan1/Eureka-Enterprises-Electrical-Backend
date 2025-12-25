import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { BonusStatus } from '../constants/bonus.constants';

@Entity('bonuses')
export class BonusEntity extends BaseEntity {
  @Index('IDX_BONUS_USER_ID')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', nullable: false })
  bonusType: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Index('IDX_BONUS_APPLICABLE_MONTH_YEAR')
  @Column({ type: 'int' })
  applicableMonth: number;

  @Column({ type: 'int' })
  applicableYear: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: false, default: BonusStatus.PENDING })
  status: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ==================== Relations ====================
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
