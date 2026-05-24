import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerifiedByUserAndRevertReason1842000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gst_register_entries
        ADD COLUMN IF NOT EXISTS "revertReason" TEXT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
        ADD COLUMN IF NOT EXISTS "revertReason" TEXT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE gst_register_entries DROP COLUMN IF EXISTS "revertReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE tds_register_entries DROP COLUMN IF EXISTS "revertReason"`,
    );
  }
}
