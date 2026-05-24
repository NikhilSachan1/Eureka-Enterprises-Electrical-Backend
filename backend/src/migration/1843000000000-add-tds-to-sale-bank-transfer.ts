import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTdsToSaleBankTransfer1843000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Add TDS fields to bank_transfers (SALE side)
    await queryRunner.query(`
      ALTER TABLE bank_transfers
        ADD COLUMN IF NOT EXISTS "tdsDeducted"   DECIMAL(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tdsPercentage" DECIMAL(5, 2)  NULL
    `);

    // Add bankTransferId to tds_register_entries (SALE side reference)
    // No FK constraint — bank_transfers is a partitioned table; integrity enforced at app level
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
        ADD COLUMN IF NOT EXISTS "bankTransferId" UUID NULL
    `);

    // Unique partial index on bankTransferId + financialYear (partition key required)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TDS_REG_BANK_TRANSFER"
        ON tds_register_entries ("bankTransferId", "financialYear")
        WHERE "bankTransferId" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TDS_REG_BANK_TRANSFER"`);
    await queryRunner.query(
      `ALTER TABLE tds_register_entries DROP COLUMN IF EXISTS "bankTransferId"`,
    );
    await queryRunner.query(
      `ALTER TABLE bank_transfers DROP COLUMN IF EXISTS "tdsDeducted", DROP COLUMN IF EXISTS "tdsPercentage"`,
    );
  }
}
