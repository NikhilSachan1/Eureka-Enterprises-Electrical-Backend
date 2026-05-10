import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGstTdsPercentageColumns1839000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // purchase_orders — gstPercentage only (no TDS on POs)
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS "gstPercentage" DECIMAL(5, 2) NULL
    `);

    // site_invoices — gstPercentage + tdsPercentage
    await queryRunner.query(`
      ALTER TABLE site_invoices
        ADD COLUMN IF NOT EXISTS "gstPercentage" DECIMAL(5, 2) NULL,
        ADD COLUMN IF NOT EXISTS "tdsPercentage" DECIMAL(5, 2) NULL
    `);

    // book_payments — gstPercentage + tdsPercentage
    await queryRunner.query(`
      ALTER TABLE book_payments
        ADD COLUMN IF NOT EXISTS "gstPercentage" DECIMAL(5, 2) NULL,
        ADD COLUMN IF NOT EXISTS "tdsPercentage" DECIMAL(5, 2) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE purchase_orders DROP COLUMN IF EXISTS "gstPercentage"`);
    await queryRunner.query(
      `ALTER TABLE site_invoices DROP COLUMN IF EXISTS "gstPercentage", DROP COLUMN IF EXISTS "tdsPercentage"`,
    );
    await queryRunner.query(
      `ALTER TABLE book_payments DROP COLUMN IF EXISTS "gstPercentage", DROP COLUMN IF EXISTS "tdsPercentage"`,
    );
  }
}
