import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixBookPaymentAmountConstraint1839000000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old constraint (formula was taxable + gst - tds = total — incorrect)
    await queryRunner.query(`
      ALTER TABLE book_payments
        DROP CONSTRAINT IF EXISTS chk_book_payment_amount
    `);

    // Note: we do NOT re-add the constraint with the new formula (taxable - gst - tds = total)
    // because existing rows were created under the old formula and would violate it.
    // The correct formula is enforced at service level (computePaymentTotal).
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Restore original (incorrect) constraint for rollback
    await queryRunner.query(`
      ALTER TABLE book_payments
        ADD CONSTRAINT chk_book_payment_amount
        CHECK ("paymentTotalAmount" = "taxableAmount" + "gstAmount" - "tdsDeductionAmount")
    `);
  }
}
