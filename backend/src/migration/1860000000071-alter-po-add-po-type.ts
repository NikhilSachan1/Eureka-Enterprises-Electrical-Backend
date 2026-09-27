import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `purchase_orders.poType` — what the PO buys: SUPPLY_ITEM | SERVICE_ITEM | BOTH.
 *
 * Only a SUPPLY_ITEM PO may raise an invoice without a JMC; material supply has nothing to measure
 * and certify. The column is **nullable on purpose**: every PO created before this has no type, and
 * a NULL is treated as JMC-mandatory, so nothing existing changes behaviour.
 *
 * The CHECK allows NULL for the same reason.
 */
export class AlterPoAddPoType1860000000071 implements MigrationInterface {
  name = 'AlterPoAddPoType1860000000071';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "poType" varchar(20)`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_type'
        ) THEN
          ALTER TABLE "purchase_orders"
            ADD CONSTRAINT "chk_po_type"
            CHECK ("poType" IS NULL OR "poType" IN ('SUPPLY_ITEM', 'SERVICE_ITEM', 'BOTH'));
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "chk_po_type"`,
    );
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "poType"`);
  }
}
