import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Advance Payment — money paid to a vendor against a PO **before** they have raised a JMC/invoice.
 *
 * The whole PURCHASE chain starts at an invoice today, so without this there is no document for
 * pre-invoice money to hang off. See docs/advance-payment-system-spec.md.
 *
 * Deliberate shapes:
 *  - `amount` is a single final figure. No taxable/GST/TDS split — an advance carries no tax
 *    treatment at all, and nothing from it enters the GST register.
 *  - `settledAmount` is a rollup of advance_settlements (next migration), kept for cheap reads.
 *    The settlement rows remain the source of truth, the same trade-off purchase_orders already
 *    makes with its invoiced/booked/paid totals.
 *  - `vendorAdvanceNumber` is nullable: some vendors give a reference for the advance, many do not.
 *  - No PDF is generated for an advance, so there is no fileKey for *our* document — `fileKey`
 *    here holds the vendor's own temporary/"kind-of" invoice that justified the payment.
 */
export class CreateAdvancePaymentsTable1860000000057 implements MigrationInterface {
  name = 'CreateAdvancePaymentsTable1860000000057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advance_payments" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "advanceNumber"       varchar(30)  NOT NULL,
        "vendorAdvanceNumber" varchar(100) NULL,
        "poId"                uuid NOT NULL,
        "siteId"              uuid NOT NULL,
        "vendorId"            uuid NOT NULL,
        "advanceDate"         date NOT NULL,
        "amount"              numeric(15,2) NOT NULL,
        "settledAmount"       numeric(15,2) NOT NULL DEFAULT 0,
        "fileKey"             varchar(500) NULL,
        "fileName"            varchar(255) NULL,
        "remarks"             text NULL,
        "approvalStatus"      varchar(20) NOT NULL DEFAULT 'PENDING',
        "approvalBy"          uuid NULL,
        "approvalAt"          timestamp NULL,
        "rejectionReason"     text NULL,
        "hasBookPayment"      boolean NOT NULL DEFAULT false,
        "createdBy"           uuid NULL,
        "updatedBy"           uuid NULL,
        "deletedBy"           uuid NULL,
        "createdAt"           timestamp NOT NULL DEFAULT NOW(),
        "updatedAt"           timestamp NOT NULL DEFAULT NOW(),
        "deletedAt"           timestamp NULL,
        CONSTRAINT "PK_advance_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_advance_payments_po"       FOREIGN KEY ("poId")       REFERENCES "purchase_orders"("id"),
        CONSTRAINT "FK_advance_payments_site"     FOREIGN KEY ("siteId")     REFERENCES "sites"("id"),
        CONSTRAINT "FK_advance_payments_vendor"   FOREIGN KEY ("vendorId")   REFERENCES "vendors"("id"),
        CONSTRAINT "FK_advance_payments_approver" FOREIGN KEY ("approvalBy") REFERENCES "users"("id"),
        CONSTRAINT "CHK_advance_payments_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "CHK_advance_payments_settled_range"
          CHECK ("settledAmount" >= 0 AND "settledAmount" <= "amount")
      )
    `);

    // Partial-unique on the live rows only: a soft-deleted advance must not block its number
    // being reissued, matching how driver_day_assignments handles release/re-claim.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ADVANCE_PAYMENTS_NUMBER"
        ON "advance_payments" ("advanceNumber")
        WHERE "deletedAt" IS NULL
    `);

    for (const col of ['poId', 'siteId', 'vendorId', 'approvalStatus', 'advanceDate']) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_ADVANCE_PAYMENTS_${col}" ON "advance_payments" ("${col}")`,
      );
    }

    await queryRunner.query(`
      COMMENT ON TABLE "advance_payments" IS
        'Money paid to a vendor against a PO before any JMC/invoice exists. Settled against invoices as they are approved (see advance_settlements). No tax split; nothing enters the GST register.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "advance_payments"`);
  }
}
