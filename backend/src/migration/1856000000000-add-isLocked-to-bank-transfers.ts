import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsLockedToBankTransfers1856000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bank_transfers ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bank_transfers DROP COLUMN IF EXISTS "isLocked"`);
  }
}
