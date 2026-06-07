import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes reportNumber, fileKey, and fileName nullable on site_reports.
 * BRD update: a report entry can be created without a report number or
 * file attachment — both are optional for contractor and vendor sides.
 */
export class MakeSiteReportFieldsNullable1851000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE site_reports
        ALTER COLUMN "reportNumber" DROP NOT NULL,
        ALTER COLUMN "fileKey"      DROP NOT NULL,
        ALTER COLUMN "fileName"     DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore NOT NULL — will fail if NULL values already exist in the DB
    await queryRunner.query(`
      ALTER TABLE site_reports
        ALTER COLUMN "reportNumber" SET NOT NULL,
        ALTER COLUMN "fileKey"      SET NOT NULL,
        ALTER COLUMN "fileName"     SET NOT NULL
    `);
  }
}
