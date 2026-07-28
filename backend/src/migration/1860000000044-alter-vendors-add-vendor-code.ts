import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add an auto-generated `vendorCode` to vendors (like the employee code). Nullable at first so
 * existing rows can be backfilled (see migration ...045); a case-insensitive unique index prevents
 * duplicates. The runtime format (prefix / padding) is config-driven — see `vendor_code_config`.
 */
export class AlterVendorsAddVendorCode1860000000044 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "vendorCode" varchar(30)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_VENDORS_VENDOR_CODE_LOWER"
       ON "vendors" (LOWER("vendorCode")) WHERE "vendorCode" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_VENDORS_VENDOR_CODE_LOWER"`);
    await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN IF EXISTS "vendorCode"`);
  }
}
