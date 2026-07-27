import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PO PDF-detail enhancement: reference number + terms & conditions on the PO, and a rich
 * multi-line description per line item (to match the fields on the PO document sent to vendors).
 */
export class AlterPoAddRefTermsItemDescription1860000000038 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "referenceNumber" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "termsAndConditions" text`,
    );
    await queryRunner.query(`ALTER TABLE "po_items" ADD COLUMN IF NOT EXISTS "description" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "po_items" DROP COLUMN IF EXISTS "description"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "termsAndConditions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "referenceNumber"`,
    );
  }
}
