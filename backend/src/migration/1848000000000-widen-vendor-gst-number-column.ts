import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widen vendors.gstNumber from varchar(15) to varchar(100).
 * GST number validation was relaxed — any string is accepted now.
 */
export class WidenVendorGstNumberColumn1848000000000 implements MigrationInterface {
  name = 'WidenVendorGstNumberColumn1848000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN "gstNumber" TYPE varchar(100)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN "gstNumber" TYPE varchar(15)`);
  }
}
