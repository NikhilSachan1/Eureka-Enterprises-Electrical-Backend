import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recomputes site_invoices."paidTotal" from the bank transfers that actually paid each invoice.
 *
 * Why: a bank transfer for an **advance** booking (book_payments."invoiceId" IS NULL) looked its
 * invoice up with `findOne({ where: { id: null } })`. TypeORM drops a null condition, so the
 * lookup returned an arbitrary invoice and the advance amount was added to that invoice's
 * paidTotal — an invoice with nothing booked could show lakhs as paid and a negative remaining.
 * Which invoice got hit depended on row order at the time, so the excess is spread over whichever
 * invoices happened to come first. The code is fixed; this puts the stored figures right.
 *
 * paidTotal is exactly what the code adds up, nothing more:
 *  - SALE: regular transfers linked straight to the invoice (bank_transfers."invoiceId").
 *  - PURCHASE: regular transfers of the invoice's own bookings (book_payments."sourceType" =
 *    'INVOICE'). Advance bookings have no invoice; GST release bookings are kept out by design.
 *  - GST transfers (bank_transfers."paymentType" = 'GST') never count — held GST is settled
 *    through the GST register, outside paidTotal.
 *
 * Only rows whose stored value differs are touched, so a correct database is left as it is and
 * running this twice changes nothing. PO rollups are not affected: they were keyed on the
 * booking's own poId, which is never null.
 *
 * `down` is a no-op — the values being replaced were wrong, and there is nothing to restore.
 */
export class RecomputeInvoicePaidTotal1860000000094 implements MigrationInterface {
  name = 'RecomputeInvoicePaidTotal1860000000094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH paid AS (
        SELECT i.id,
               COALESCE((
                 SELECT SUM(bt."transferAmount")
                   FROM bank_transfers bt
                  WHERE bt."deletedAt" IS NULL
                    AND bt."invoiceId" = i.id
                    AND COALESCE(bt."paymentType", 'REGULAR') <> 'GST'
               ), 0)
             + COALESCE((
                 SELECT SUM(bt."transferAmount")
                   FROM bank_transfers bt
                   JOIN book_payments bp ON bp.id = bt."bookPaymentId"
                  WHERE bt."deletedAt" IS NULL
                    AND bp."invoiceId" = i.id
                    AND bp."sourceType" = 'INVOICE'
                    AND COALESCE(bt."paymentType", 'REGULAR') <> 'GST'
               ), 0) AS "actualPaid"
          FROM site_invoices i
      )
      UPDATE site_invoices si
         SET "paidTotal" = paid."actualPaid",
             "updatedAt" = NOW()
        FROM paid
       WHERE paid.id = si.id
         AND ABS(COALESCE(si."paidTotal", 0) - paid."actualPaid") > 0.005
    `);
  }

  public async down(): Promise<void> {
    // Nothing to restore: the replaced values were the wrong ones.
  }
}
