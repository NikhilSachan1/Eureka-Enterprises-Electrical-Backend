import { MigrationInterface, QueryRunner } from 'typeorm';

export class TdsRegisterMoveToBookPayment1840000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Add bookPaymentId column
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
        ADD COLUMN IF NOT EXISTS "bookPaymentId" UUID NULL
    `);

    // Add FK constraint
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
        ADD CONSTRAINT FK_TDS_REG_BOOK_PAYMENT
        FOREIGN KEY ("bookPaymentId") REFERENCES book_payments(id)
        ON DELETE SET NULL
    `);

    // Drop old unique index on invoiceId
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TDS_REG_INVOICE"`);

    // Re-create as non-unique
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TDS_REG_INVOICE"
        ON tds_register_entries ("invoiceId")
    `);

    // Add unique partial index on bookPaymentId + financialYear (partition key required)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TDS_REG_BOOK_PAYMENT"
        ON tds_register_entries ("bookPaymentId", "financialYear")
        WHERE "bookPaymentId" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TDS_REG_BOOK_PAYMENT"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TDS_REG_INVOICE"`);
    await queryRunner.query(
      `ALTER TABLE tds_register_entries DROP CONSTRAINT IF EXISTS FK_TDS_REG_BOOK_PAYMENT`,
    );
    await queryRunner.query(
      `ALTER TABLE tds_register_entries DROP COLUMN IF EXISTS "bookPaymentId"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_TDS_REG_INVOICE" ON tds_register_entries ("invoiceId")
    `);
  }
}
