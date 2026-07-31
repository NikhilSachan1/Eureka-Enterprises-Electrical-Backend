import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop the unused `referenceNumber` column from `purchase_orders`. It was briefly added (dev only)
 * but is not needed — the PO now shows the vendor's code instead. DROP IF EXISTS so this is a
 * no-op on environments where it was never created.
 */
export class AlterPoDropReferenceNumber1860000000043 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "referenceNumber"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "referenceNumber" varchar(100)`,
    );
  }
}
