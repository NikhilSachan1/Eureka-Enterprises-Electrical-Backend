import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill rollup columns to include TDS in effective settled amounts.
 *
 * Before the fix, paidTotal (SALE) and bookedTotal (PURCHASE) were computed
 * without TDS. This migration recomputes them from source records.
 *
 * SALE — site_invoices.paidTotal:
 *   Was: Σ transferAmount
 *   Now: Σ (transferAmount + tdsDeducted)
 *
 * PURCHASE — site_invoices.bookedTotal:
 *   Was: Σ paymentTotalAmount
 *   Now: Σ (paymentTotalAmount + tdsDeductionAmount)
 *
 * PO rollups are updated the same way.
 */
export class BackfillRollupsWithTds1840000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── SALE: fix invoice paidTotal ─────────────────────────────────────────
    await queryRunner.query(`
      UPDATE site_invoices si
      SET "paidTotal" = COALESCE((
        SELECT SUM(bt."transferAmount" + COALESCE(bt."tdsDeducted", 0))
        FROM bank_transfers bt
        WHERE bt."invoiceId" = si.id
          AND bt."deletedAt" IS NULL
      ), 0)
      WHERE si."partyType" = 'SALE'
        AND si."deletedAt" IS NULL
    `);

    // ── SALE: fix PO paidTotal ──────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE purchase_orders po
      SET "paidTotal" = COALESCE((
        SELECT SUM(bt."transferAmount" + COALESCE(bt."tdsDeducted", 0))
        FROM bank_transfers bt
        WHERE bt."poId" = po.id
          AND bt."partyType" = 'SALE'
          AND bt."deletedAt" IS NULL
      ), 0)
      WHERE po."partyType" = 'SALE'
        AND po."deletedAt" IS NULL
    `);

    // ── PURCHASE: fix invoice bookedTotal ───────────────────────────────────
    await queryRunner.query(`
      UPDATE site_invoices si
      SET "bookedTotal" = COALESCE((
        SELECT SUM(bp."paymentTotalAmount" + COALESCE(bp."tdsDeductionAmount", 0))
        FROM book_payments bp
        WHERE bp."invoiceId" = si.id
          AND bp."deletedAt" IS NULL
      ), 0)
      WHERE si."partyType" = 'PURCHASE'
        AND si."deletedAt" IS NULL
    `);

    // ── PURCHASE: fix PO bookedTotal ────────────────────────────────────────
    await queryRunner.query(`
      UPDATE purchase_orders po
      SET "bookedTotal" = COALESCE((
        SELECT SUM(bp."paymentTotalAmount" + COALESCE(bp."tdsDeductionAmount", 0))
        FROM book_payments bp
        WHERE bp."poId" = po.id
          AND bp."deletedAt" IS NULL
      ), 0)
      WHERE po."partyType" = 'PURCHASE'
        AND po."deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to old computation (without TDS)

    await queryRunner.query(`
      UPDATE site_invoices si
      SET "paidTotal" = COALESCE((
        SELECT SUM(bt."transferAmount")
        FROM bank_transfers bt
        WHERE bt."invoiceId" = si.id
          AND bt."deletedAt" IS NULL
      ), 0)
      WHERE si."partyType" = 'SALE'
        AND si."deletedAt" IS NULL
    `);

    await queryRunner.query(`
      UPDATE purchase_orders po
      SET "paidTotal" = COALESCE((
        SELECT SUM(bt."transferAmount")
        FROM bank_transfers bt
        WHERE bt."poId" = po.id
          AND bt."partyType" = 'SALE'
          AND bt."deletedAt" IS NULL
      ), 0)
      WHERE po."partyType" = 'SALE'
        AND po."deletedAt" IS NULL
    `);

    await queryRunner.query(`
      UPDATE site_invoices si
      SET "bookedTotal" = COALESCE((
        SELECT SUM(bp."paymentTotalAmount")
        FROM book_payments bp
        WHERE bp."invoiceId" = si.id
          AND bp."deletedAt" IS NULL
      ), 0)
      WHERE si."partyType" = 'PURCHASE'
        AND si."deletedAt" IS NULL
    `);

    await queryRunner.query(`
      UPDATE purchase_orders po
      SET "bookedTotal" = COALESCE((
        SELECT SUM(bp."paymentTotalAmount")
        FROM book_payments bp
        WHERE bp."poId" = po.id
          AND bp."deletedAt" IS NULL
      ), 0)
      WHERE po."partyType" = 'PURCHASE'
        AND po."deletedAt" IS NULL
    `);
  }
}
