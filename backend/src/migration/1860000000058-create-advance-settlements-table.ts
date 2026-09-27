import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One row per "this invoice consumed this much of this advance".
 *
 * A join table rather than a column on either side, because the relationship is many-to-many in
 * both directions: one advance can be consumed by several invoices ("10 baar mein settle ho sakta
 * hai"), and one invoice can draw on several advances when no single advance covers it.
 *
 * This is also the only audit trail of which rupee went where — `advance_payments.settledAmount`
 * is just a cached sum of these rows and cannot answer "which invoice consumed it".
 *
 * Rows are created when an invoice is APPROVED and deleted if that approval is reversed
 * (rejected / unlocked), which is what restores the advance balance.
 */
export class CreateAdvanceSettlementsTable1860000000058 implements MigrationInterface {
  name = 'CreateAdvanceSettlementsTable1860000000058';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advance_settlements" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "advancePaymentId"  uuid NOT NULL,
        "invoiceId"         uuid NOT NULL,
        "amount"            numeric(15,2) NOT NULL,
        "settledAt"         timestamp NOT NULL DEFAULT NOW(),
        "createdBy"         uuid NULL,
        "createdAt"         timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_advance_settlements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_advance_settlements_advance"
          FOREIGN KEY ("advancePaymentId") REFERENCES "advance_payments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_advance_settlements_invoice"
          FOREIGN KEY ("invoiceId") REFERENCES "site_invoices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_advance_settlements_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id"),
        CONSTRAINT "CHK_advance_settlements_amount_positive" CHECK ("amount" > 0)
      )
    `);

    // An invoice draws from a given advance at most once — the settlement algorithm computes a
    // single `take` per (advance, invoice) pair, so a second row would mean it ran twice.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ADVANCE_SETTLEMENT_PAIR"
        ON "advance_settlements" ("advancePaymentId", "invoiceId")
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ADVANCE_SETTLEMENTS_ADVANCE" ON "advance_settlements" ("advancePaymentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ADVANCE_SETTLEMENTS_INVOICE" ON "advance_settlements" ("invoiceId")`,
    );

    await queryRunner.query(`
      COMMENT ON TABLE "advance_settlements" IS
        'Audit trail of advance consumed per invoice. advance_payments.settledAmount is a cached sum of these rows. ON DELETE CASCADE so removing an advance or invoice cannot leave orphan settlements.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "advance_settlements"`);
  }
}
