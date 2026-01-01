import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { CardExpiryStatus } from '../constants/card.constants';

@Entity('cards')
@Index('idx_cards_cardNumber', ['cardNumber'])
@Index('idx_cards_cardType', ['cardType'])
@Index('idx_cards_cardName', ['cardName'])
@Index('idx_cards_expiryStatus', ['expiryStatus'])
export class CardsEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  cardNumber: string;

  @Column({ type: 'varchar', nullable: false })
  cardType: string;

  @Column({ type: 'varchar', nullable: true })
  cardName: string;

  @Column({ type: 'varchar', nullable: true })
  holderName: string;

  @Column({ type: 'varchar', nullable: true })
  expiryDate: string;

  @Column({ type: 'varchar', length: 20, default: CardExpiryStatus.VALID })
  expiryStatus: string;
}
