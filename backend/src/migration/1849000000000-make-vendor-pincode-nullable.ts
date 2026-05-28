import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make vendors.pincode nullable — pincode is optional per business requirement.
 */
export class MakeVendorPincodeNullable1849000000000 implements MigrationInterface {
  name = 'MakeVendorPincodeNullable1849000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN pincode DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE vendors SET pincode = '' WHERE pincode IS NULL`);
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN pincode SET NOT NULL`);
  }
}
