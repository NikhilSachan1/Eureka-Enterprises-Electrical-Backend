import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeInvoiceFieldsNullable1858000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE site_invoices
        ALTER COLUMN "invoiceNumber" DROP NOT NULL,
        ALTER COLUMN "invoiceDate"   DROP NOT NULL,
        ALTER COLUMN "taxableAmount" DROP NOT NULL,
        ALTER COLUMN "gstAmount"     DROP NOT NULL,
        ALTER COLUMN "tdsAmount"     DROP NOT NULL,
        ALTER COLUMN "totalAmount"   DROP NOT NULL,
        ALTER COLUMN "fileKey"       DROP NOT NULL,
        ALTER COLUMN "fileName"      DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE site_invoices SET "invoiceNumber" = '' WHERE "invoiceNumber" IS NULL;
      UPDATE site_invoices SET "invoiceDate"   = NOW() WHERE "invoiceDate" IS NULL;
      UPDATE site_invoices SET "taxableAmount" = 0 WHERE "taxableAmount" IS NULL;
      UPDATE site_invoices SET "gstAmount"     = 0 WHERE "gstAmount" IS NULL;
      UPDATE site_invoices SET "tdsAmount"     = 0 WHERE "tdsAmount" IS NULL;
      UPDATE site_invoices SET "totalAmount"   = 0 WHERE "totalAmount" IS NULL;
      UPDATE site_invoices SET "fileKey"       = '' WHERE "fileKey" IS NULL;
      UPDATE site_invoices SET "fileName"      = '' WHERE "fileName" IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE site_invoices
        ALTER COLUMN "invoiceNumber" SET NOT NULL,
        ALTER COLUMN "invoiceDate"   SET NOT NULL,
        ALTER COLUMN "taxableAmount" SET NOT NULL,
        ALTER COLUMN "gstAmount"     SET NOT NULL,
        ALTER COLUMN "tdsAmount"     SET NOT NULL,
        ALTER COLUMN "totalAmount"   SET NOT NULL,
        ALTER COLUMN "fileKey"       SET NOT NULL,
        ALTER COLUMN "fileName"      SET NOT NULL
    `);
  }
}
