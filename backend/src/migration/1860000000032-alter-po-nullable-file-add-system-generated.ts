import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PO system-generated enhancement (1/4).
 * - fileKey/fileName NULLABLE (system-generated PO has no uploaded scan).
 * - isSystemGenerated flag (true when created with line items).
 * - gstType ('CGST_SGST' | 'IGST') for the PDF tax split. Existing rows default to CGST_SGST.
 * Backward-compatible: existing upload-based POs keep fileKey and isSystemGenerated=false.
 */
export class AlterPoNullableFileAddSystemGenerated1860000000032 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "fileKey" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "fileName" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "isSystemGenerated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "gstType" varchar(10) NOT NULL DEFAULT 'CGST_SGST'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "gstType"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "isSystemGenerated"`,
    );
    await queryRunner.query(
      `UPDATE "purchase_orders" SET "fileKey" = '' WHERE "fileKey" IS NULL;
       UPDATE "purchase_orders" SET "fileName" = '' WHERE "fileName" IS NULL;`,
    );
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "fileKey" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "fileName" SET NOT NULL`);
  }
}
