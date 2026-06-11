import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentHoldAmountToBookPayments1855000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE book_payments
        ADD COLUMN IF NOT EXISTS "paymentHoldAmount" NUMERIC(15,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE book_payments
        DROP COLUMN IF EXISTS "paymentHoldAmount"
    `);
  }
}
