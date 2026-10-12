import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Approval now raises an advance's book payment automatically, which puts the advance on the
 * Payment Sheet → Bank Transfer → Payment Advice route like every other payable.
 *
 * Advances approved *before* that change have no book payment, so they are invisible to the
 * payment sheet and cannot be paid without someone booking them by hand. This gives them the same
 * row approval would have created.
 *
 * Deliberately narrow: only advances that are APPROVED, not deleted, and have **no** live book
 * payment at all. An advance already booked — fully or partly, by hand — is left alone, so this
 * cannot double-book anything and is safe to re-run.
 *
 * The PO's `bookedTotal` is rolled up by the same amount, matching what the service does, so the
 * PO's figures do not drift from the rows underneath them.
 */
export class BackfillAdvanceBookPayments1860000000069 implements MigrationInterface {
  name = 'BackfillAdvanceBookPayments1860000000069';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const pending: Array<{ id: string; amount: string; poId: string }> = await queryRunner.query(`
      SELECT ap."id", ap."amount", ap."poId"
        FROM advance_payments ap
       WHERE ap."approvalStatus" = 'APPROVED'
         AND ap."deletedAt" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM book_payments bp
            WHERE bp."advancePaymentId" = ap."id"
              AND bp."deletedAt" IS NULL
              AND bp."approvalStatus" <> 'REJECTED'
         )
    `);

    if (pending.length === 0) return;

    // Booked as approved and locked, exactly as approval would: the advance is already approved,
    // so a second approval step would be asking the same question twice.
    await queryRunner.query(`
      INSERT INTO book_payments (
        "sourceType", "advancePaymentId", "invoiceId", "siteId", "vendorId", "poId",
        "bookingDate", "taxableAmount", "gstAmount", "gstPercentage",
        "paymentTotalAmount", "paymentHoldAmount", "paymentHoldReason", "remarks",
        "approvalStatus", "approvalBy", "approvalAt", "isLocked", "hasTransfer",
        "createdBy", "createdAt", "updatedAt"
      )
      SELECT
        'ADVANCE', ap."id", NULL, ap."siteId", ap."vendorId", ap."poId",
        COALESCE(ap."approvalAt", NOW()), ap."amount", 0, NULL,
        ap."amount", 0, NULL,
        'Backfilled on approval of advance ' || ap."advanceNumber",
        'APPROVED', ap."approvalBy", COALESCE(ap."approvalAt", NOW()), true, false,
        ap."approvalBy", NOW(), NOW()
        FROM advance_payments ap
       WHERE ap."approvalStatus" = 'APPROVED'
         AND ap."deletedAt" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM book_payments bp
            WHERE bp."advancePaymentId" = ap."id"
              AND bp."deletedAt" IS NULL
              AND bp."approvalStatus" <> 'REJECTED'
         )
    `);

    // Freeze those advances against edit/delete — money is now on its way out.
    await queryRunner.query(
      `UPDATE advance_payments SET "hasBookPayment" = true WHERE id = ANY($1)`,
      [pending.map((p) => p.id)],
    );

    // Roll the booked amounts into their POs, one statement, grouped by PO.
    await queryRunner.query(
      `UPDATE purchase_orders po
          SET "bookedTotal" = COALESCE(po."bookedTotal", 0) + agg.total,
              "updatedAt"   = NOW()
         FROM (
           SELECT ap."poId" AS po_id, SUM(ap."amount") AS total
             FROM advance_payments ap
            WHERE ap."id" = ANY($1)
            GROUP BY ap."poId"
         ) agg
        WHERE po."id" = agg.po_id`,
      [pending.map((p) => p.id)],
    );
  }

  /**
   * Removes only the rows this migration could have written — advance-backed, still unpaid, and
   * carrying the backfill remark — and takes their amounts back out of the PO rollup. A booking
   * that has since been transferred is left alone; undoing a payment is the reverse flow's job,
   * not a migration's.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: string; advancePaymentId: string; poId: string; amount: string }> =
      await queryRunner.query(`
        SELECT "id", "advancePaymentId", "poId", "paymentTotalAmount" AS amount
          FROM book_payments
         WHERE "sourceType" = 'ADVANCE'
           AND "deletedAt" IS NULL
           AND "hasTransfer" = false
           AND "remarks" LIKE 'Backfilled on approval of advance %'
      `);

    if (rows.length === 0) return;

    await queryRunner.query(
      `UPDATE purchase_orders po
          SET "bookedTotal" = GREATEST(COALESCE(po."bookedTotal", 0) - agg.total, 0)
         FROM (
           SELECT "poId" AS po_id, SUM("paymentTotalAmount") AS total
             FROM book_payments WHERE "id" = ANY($1) GROUP BY "poId"
         ) agg
        WHERE po."id" = agg.po_id`,
      [rows.map((r) => r.id)],
    );
    await queryRunner.query(`DELETE FROM book_payments WHERE "id" = ANY($1)`, [
      rows.map((r) => r.id),
    ]);
    await queryRunner.query(
      `UPDATE advance_payments SET "hasBookPayment" = false WHERE "id" = ANY($1)`,
      [rows.map((r) => r.advancePaymentId)],
    );
  }
}
