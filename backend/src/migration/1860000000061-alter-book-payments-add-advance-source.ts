import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a book payment be raised against an **advance payment** instead of an invoice.
 *
 * Until now `book_payments.invoiceId` was NOT NULL, which is precisely why pre-invoice money had
 * nowhere to go. Three changes:
 *
 *   1. `invoiceId` becomes nullable.
 *   2. `sourceType` discriminates INVOICE vs ADVANCE. `DEFAULT 'INVOICE'` backfills every existing
 *      row correctly — each one is invoice-backed by definition, since nothing else was possible.
 *   3. A CHECK constraint makes "exactly one source, matching sourceType" a database guarantee
 *      rather than a convention application code has to remember. Dropping NOT NULL without this
 *      would allow a book payment with neither source, or with both.
 *
 * The constraint is added last, after the backfill default is in place, so existing rows satisfy
 * it at the moment it is created.
 */
export class AlterBookPaymentsAddAdvanceSource1860000000061 implements MigrationInterface {
  name = 'AlterBookPaymentsAddAdvanceSource1860000000061';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "book_payments" ALTER COLUMN "invoiceId" DROP NOT NULL`);

    await queryRunner.query(
      `ALTER TABLE "book_payments"
         ADD COLUMN IF NOT EXISTS "sourceType" varchar(20) NOT NULL DEFAULT 'INVOICE'`,
    );

    await queryRunner.query(
      `ALTER TABLE "book_payments"
         ADD COLUMN IF NOT EXISTS "advancePaymentId" uuid NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "book_payments"
         ADD CONSTRAINT "FK_book_payments_advance"
         FOREIGN KEY ("advancePaymentId") REFERENCES "advance_payments"("id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_BOOK_PAYMENT_ADVANCE"
         ON "book_payments" ("advancePaymentId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "book_payments"
        ADD CONSTRAINT "CHK_BOOK_PAYMENT_SOURCE" CHECK (
          ("sourceType" = 'INVOICE' AND "invoiceId" IS NOT NULL AND "advancePaymentId" IS NULL)
          OR
          ("sourceType" = 'ADVANCE' AND "advancePaymentId" IS NOT NULL AND "invoiceId" IS NULL)
        )
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "book_payments"."sourceType" IS
        'INVOICE (invoiceId set) or ADVANCE (advancePaymentId set). Enforced by CHK_BOOK_PAYMENT_SOURCE.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "book_payments" DROP CONSTRAINT IF EXISTS "CHK_BOOK_PAYMENT_SOURCE"`,
    );
    // Advance-backed rows have no invoiceId, so they must go before NOT NULL can be restored.
    await queryRunner.query(`DELETE FROM "book_payments" WHERE "sourceType" = 'ADVANCE'`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_BOOK_PAYMENT_ADVANCE"`);
    await queryRunner.query(
      `ALTER TABLE "book_payments" DROP CONSTRAINT IF EXISTS "FK_book_payments_advance"`,
    );
    await queryRunner.query(`ALTER TABLE "book_payments" DROP COLUMN IF EXISTS "advancePaymentId"`);
    await queryRunner.query(`ALTER TABLE "book_payments" DROP COLUMN IF EXISTS "sourceType"`);
    await queryRunner.query(`ALTER TABLE "book_payments" ALTER COLUMN "invoiceId" SET NOT NULL`);
  }
}
