import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { CompanyBankAccountEntity } from 'src/modules/company-bank-accounts/entities/company-bank-account.entity';
import { WalletRechargeStatus } from '../constants/petro-card-wallet.constants';

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
   * PENDING until the money is actually paid.
   *
   * This is what keeps the balance honest. A recharge is raised on the wallet screen, where it is
   * a *request* and nothing more; only the Payment Sheet pay step flips it to PAID, and only PAID
   * rows count towards the balance. Without it the wallet showed money against a payment nobody
   * had made.
   */
  @Column({ type: 'varchar', length: 16, default: WalletRechargeStatus.PENDING })
  status: WalletRechargeStatus;

  /**
   * The Payment Sheet line this recharge was picked onto, or NULL while it is still outstanding.
   *
   * Set when the line is added to a sheet, not at payment — that is what stops one recharge being
   * picked onto two sheets. Whether it is *still* claimed is derived rather than stored: if the
   * line or its sheet is later rejected or removed, the recharge is outstanding again, with no
   * release step for anyone to forget.
   */
  @Column({ type: 'uuid', nullable: true })
  paymentSheetItemId: string | null;
}
