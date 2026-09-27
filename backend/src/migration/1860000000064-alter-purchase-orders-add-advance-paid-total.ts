import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `purchase_orders.advancePaidTotal` — money paid against a PO as an advance, with no invoice
 * behind it yet (advance payment phase 4).
 *
 * Kept separate from `paidTotal` on purpose. The dashboard derives pending billing as
 * `invoicedTotal − paidTotal`; folding an advance into `paidTotal` would make that figure go
 * negative for any PO paid before it was billed, which reads as a broken dashboard rather than as
 * the advance it actually is.
 *
 * Unlike phase 3's column this one **is** backfilled: approved advances already exist, and the
 * rollup is only maintained forward from here, so without a backfill every PO with an existing
 * advance would report 0 forever. Counts APPROVED only, matching both the headroom check and the
 * rollup maintenance in AdvancePaymentService.
 */
export class AlterPurchaseOrdersAddAdvancePaidTotal1860000000064 implements MigrationInterface {
  name = 'AlterPurchaseOrdersAddAdvancePaidTotal1860000000064';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders"
         ADD COLUMN IF NOT EXISTS "advancePaidTotal" numeric(15,2) NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `UPDATE "purchase_orders" po
          SET "advancePaidTotal" = COALESCE(a.total, 0)
         FROM (
           SELECT "poId", SUM(amount) AS total
             FROM "advance_payments"
            WHERE "deletedAt" IS NULL AND "approvalStatus" = 'APPROVED'
            GROUP BY "poId"
         ) a
        WHERE a."poId" = po.id`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "advancePaidTotal"`,
    );
  }
}
