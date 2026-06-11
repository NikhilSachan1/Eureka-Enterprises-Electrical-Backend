import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTdsFromBookPaymentsAndBankTransfers1836000000005 implements MigrationInterface {
  name = 'RemoveTdsFromBookPaymentsAndBankTransfers1836000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop TDS columns from book_payments
    await queryRunner.query(`ALTER TABLE book_payments DROP COLUMN IF EXISTS "tdsDeductionAmount"`);
    await queryRunner.query(`ALTER TABLE book_payments DROP COLUMN IF EXISTS "tdsPercentage"`);

    // Drop TDS columns from bank_transfers (SALE side only)
    await queryRunner.query(`ALTER TABLE bank_transfers DROP COLUMN IF EXISTS "tdsDeducted"`);
    await queryRunner.query(`ALTER TABLE bank_transfers DROP COLUMN IF EXISTS "tdsPercentage"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bank_transfers ADD COLUMN IF NOT EXISTS "tdsPercentage" decimal(5,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bank_transfers ADD COLUMN IF NOT EXISTS "tdsDeducted" decimal(15,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE book_payments ADD COLUMN IF NOT EXISTS "tdsPercentage" decimal(5,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE book_payments ADD COLUMN IF NOT EXISTS "tdsDeductionAmount" decimal(15,2) NOT NULL DEFAULT 0`,
    );
  }
}
