import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make contractors.pincode nullable — pincode is optional per business requirement.
 */
export class MakeContractorPincodeNullable1847000000000 implements MigrationInterface {
  name = 'MakeContractorPincodeNullable1847000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contractors ALTER COLUMN pincode DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Set blank pincodes to empty string first to avoid violating NOT NULL on revert
    await queryRunner.query(`UPDATE contractors SET pincode = '' WHERE pincode IS NULL`);
    await queryRunner.query(`ALTER TABLE contractors ALTER COLUMN pincode SET NOT NULL`);
  }
}
