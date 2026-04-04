import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDsrEntryType1816000000000 implements MigrationInterface {
  name = 'AddDsrEntryType1816000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports"
      ADD COLUMN "dsrEntryType" character varying(20) NOT NULL DEFAULT 'SELF'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "daily_status_reports"."dsrEntryType" IS 'SELF = standard create; FORCED = force endpoint'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports"
      DROP COLUMN "dsrEntryType"
    `);
  }
}
