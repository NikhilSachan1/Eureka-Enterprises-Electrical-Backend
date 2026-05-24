import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerifyFieldsToGstTdsRegister1841000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gst_register_entries
        ADD COLUMN IF NOT EXISTS "verifyFileKey"  VARCHAR(500) NULL,
        ADD COLUMN IF NOT EXISTS "verifyFileName" VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS "verifyRemarks"  TEXT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE tds_register_entries
        ADD COLUMN IF NOT EXISTS "verifyFileKey"  VARCHAR(500) NULL,
        ADD COLUMN IF NOT EXISTS "verifyFileName" VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS "verifyRemarks"  TEXT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gst_register_entries
        DROP COLUMN IF EXISTS "verifyFileKey",
        DROP COLUMN IF EXISTS "verifyFileName",
        DROP COLUMN IF EXISTS "verifyRemarks"
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
        DROP COLUMN IF EXISTS "verifyFileKey",
        DROP COLUMN IF EXISTS "verifyFileName",
        DROP COLUMN IF EXISTS "verifyRemarks"
    `);
  }
}
