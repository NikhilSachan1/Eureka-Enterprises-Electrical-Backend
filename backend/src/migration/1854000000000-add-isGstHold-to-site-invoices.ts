import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsGstHoldToSiteInvoices1854000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE site_invoices
        ADD COLUMN IF NOT EXISTS "isGstHold" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE site_invoices
        DROP COLUMN IF EXISTS "isGstHold"
    `);
  }
}
