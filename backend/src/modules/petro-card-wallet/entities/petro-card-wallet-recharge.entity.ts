import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { CompanyBankAccountEntity } from 'src/modules/company-bank-accounts/entities/company-bank-account.entity';

/**
 * One recharge into the single common PetroCard wallet.
 *
 * There is no wallet entity to sit beside this one: there is exactly one wallet, and its balance is
 * derived (recharges minus live petro-card fuel entries), so a wallet row would hold nothing but
 * its own id. See `docs/petro-card-wallet-spec.md` for why the balance is not stored.
 */
@Entity('petro_card_wallet_recharges')
@Index('idx_petro_card_recharge_date', ['rechargeDate'])
@Index('idx_petro_card_recharge_deleted_at', ['deletedAt'])
export class PetroCardWalletRechargeEntity extends BaseEntity {
  /** Always positive — a CHECK enforces it. Recharges only add; there is no manual debit. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  amount: number;

  /** When the money actually went in, which is not necessarily when it was recorded. */
  @Column({ type: 'timestamp', nullable: false })
  rechargeDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  paymentMode: string | null;

  /** Which of the org's own accounts funded the recharge — same pattern as the rest of the app. */
  @Column({ type: 'uuid', nullable: true })
  paidFromAccountId: string | null;

  @ManyToOne(() => CompanyBankAccountEntity, { nullable: true })
  @JoinColumn({ name: 'paidFromAccountId' })
  paidFromAccount: CompanyBankAccountEntity | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  /**
   * The paid Payment Sheet line this recharge came from, or NULL for a manual correction.
   *
   * Set means read-only: a payment sheet item is terminal once PAID, so letting the wallet CRUD
   * edit or delete the row it produced would be a back door around that.
   */
  @Column({ type: 'uuid', nullable: true })
  paymentSheetItemId: string | null;
}
