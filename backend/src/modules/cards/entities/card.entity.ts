import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

@Entity('cards')
@Index('idx_cards_cardNumber', ['cardNumber'])
@Index('idx_cards_cardType', ['cardType'])
export class CardsEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  cardNumber: string;

  @Column({ type: 'varchar', nullable: false })
  cardType: string;

  @Column({ type: 'varchar', nullable: false })
  holderName: string;

  @Column({ type: 'varchar', nullable: false })
  expiryDate: string;
}
