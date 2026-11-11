import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TDS challans are identified by their UTR / reference number only — the BSR code and challan
 * serial number added in 1860000000091 are not captured any more.
 *
 * UTR becomes mandatory again. Rows recorded while it was optional fall back to their challan
 * serial number so no challan is left without a reference.
 */
export class TdsPaymentsDropBsrChallanSerial1860000000092 implements MigrationInterface {
  name = 'TdsPaymentsDropBsrChallanSerial1860000000092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tds_payments
         SET "utrNumber" = COALESCE(NULLIF("utrNumber", ''), "challanSerialNumber", '')
       WHERE "utrNumber" IS NULL OR "utrNumber" = ''
    `);
    await queryRunner.query(`
      ALTER TABLE tds_payments
        ALTER COLUMN "utrNumber" SET NOT NULL,
        DROP COLUMN IF EXISTS "bsrCode",
        DROP COLUMN IF EXISTS "challanSerialNumber"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tds_payments
        ADD COLUMN IF NOT EXISTS "bsrCode" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "challanSerialNumber" varchar(20) NULL,
        ALTER COLUMN "utrNumber" DROP NOT NULL
    `);
  }
}
