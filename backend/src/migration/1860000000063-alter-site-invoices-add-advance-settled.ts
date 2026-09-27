import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `site_invoices.advanceSettledAmount` — how much of an invoice was covered by advances
 * already paid to the vendor (advance payment phase 3).
 *
 * The column is what stops the same work being paid for twice: the book-payment ceiling subtracts
 * it, so an invoice whose value has already reached the vendor as an advance cannot also be booked
 * in full.
 *
 * No backfill. Settlement did not exist before this phase, so nothing has ever been settled and 0
 * is the correct value for every existing row.
 *
 * Idempotent: IF NOT EXISTS / IF EXISTS.
 */
export class AlterSiteInvoicesAddAdvanceSettled1860000000063 implements MigrationInterface {
  name = 'AlterSiteInvoicesAddAdvanceSettled1860000000063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "site_invoices"
         ADD COLUMN IF NOT EXISTS "advanceSettledAmount" numeric(15,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "site_invoices" DROP COLUMN IF EXISTS "advanceSettledAmount"`,
    );
  }
}
