import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Held GST now moves through the normal payment chain instead of being recorded directly.
 *
 *  PURCHASE (release to vendor): GST summary → GST book payment (sourceType GST_RELEASE)
 *    → payment sheet / bank transfer. The entry is "release in process" once booked and
 *    "released" once the bank transfer goes out.
 *  SALE (receipt from client): GST summary → a GST bank transfer straight away.
 *
 * Changes
 *  - gst_register_entries."gstBookPaymentId"  — the GST book payment (purchase only).
 *  - gst_register_entries."gstBankTransferId" — the bank transfer that actually moved the GST.
 *    Settled = "gstBankTransferId" set, or legacy "gstPaymentId" set (direct records, kept as-is).
 *  - book_payments: CHK_BOOK_PAYMENT_SOURCE also allows GST_RELEASE (invoice-backed).
 *  - bank_transfers."paymentType" — REGULAR | GST, so a GST payment is told apart from an
 *    invoice payment. GST transfers never touch invoice / PO paidTotal (the payment ceiling on a
 *    held invoice is taxable − TDS); their settlement is read through the GST register.
 */
export class GstReleaseViaBookPayment1860000000093 implements MigrationInterface {
  name = 'GstReleaseViaBookPayment1860000000093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gst_register_entries
        ADD COLUMN IF NOT EXISTS "gstBookPaymentId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "gstBankTransferId" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_GST_REG_BOOK_PAYMENT" ON gst_register_entries ("gstBookPaymentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_GST_REG_BANK_TRANSFER" ON gst_register_entries ("gstBankTransferId")
    `);

    await queryRunner.query(
      `ALTER TABLE "book_payments" DROP CONSTRAINT IF EXISTS "CHK_BOOK_PAYMENT_SOURCE"`,
    );
    await queryRunner.query(`
      ALTER TABLE "book_payments"
        ADD CONSTRAINT "CHK_BOOK_PAYMENT_SOURCE" CHECK (
          ("sourceType" IN ('INVOICE', 'GST_RELEASE') AND "invoiceId" IS NOT NULL AND "advancePaymentId" IS NULL)
          OR
          ("sourceType" = 'ADVANCE' AND "advancePaymentId" IS NOT NULL AND "invoiceId" IS NULL)
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "bank_transfers"
        ADD COLUMN IF NOT EXISTS "paymentType" varchar(20) NOT NULL DEFAULT 'REGULAR'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "paymentType"`);

    await queryRunner.query(
      `ALTER TABLE "book_payments" DROP CONSTRAINT IF EXISTS "CHK_BOOK_PAYMENT_SOURCE"`,
    );
    // GST bookings cannot satisfy the old constraint.
    await queryRunner.query(`DELETE FROM "book_payments" WHERE "sourceType" = 'GST_RELEASE'`);
    await queryRunner.query(`
      ALTER TABLE "book_payments"
        ADD CONSTRAINT "CHK_BOOK_PAYMENT_SOURCE" CHECK (
          ("sourceType" = 'INVOICE' AND "invoiceId" IS NOT NULL AND "advancePaymentId" IS NULL)
          OR
          ("sourceType" = 'ADVANCE' AND "advancePaymentId" IS NOT NULL AND "invoiceId" IS NULL)
        )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_GST_REG_BANK_TRANSFER"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_GST_REG_BOOK_PAYMENT"`);
    await queryRunner.query(`
      ALTER TABLE gst_register_entries
        DROP COLUMN IF EXISTS "gstBankTransferId",
        DROP COLUMN IF EXISTS "gstBookPaymentId"
    `);
  }
}
