import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

/**
 * The organization's own bank accounts — the SOURCE of funds for outgoing payments
 * (vendor bank transfers, employee expense/fuel settlements, payment-sheet pay-outs).
 * Not to be confused with employee/vendor bank details, which are the RECIPIENT side.
 */
@Entity('company_bank_accounts')
@Index('IDX_COMPANY_BANK_ACCOUNT_ACTIVE', ['isActive'])
export class CompanyBankAccountEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  accountName: string; // e.g. "HDFC Current A/c — Operations"

  @Column({ type: 'varchar', length: 255 })
  accountHolderName: string; // legal name on the account

  @Column({ type: 'varchar', length: 255 })
  bankName: string;

  @Column({ type: 'varchar', length: 50 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 20 })
  ifscCode: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branchName: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}
