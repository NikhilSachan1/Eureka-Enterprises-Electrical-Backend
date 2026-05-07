import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the bank_transfers table with PARTITION BY RANGE (financialYear).
 *
 * Plan §3.4 hardening #7 — partitioning enables:
 *   - Fast queries scoped to a single financial year (partition pruning)
 *   - Easy archival of old years (DROP PARTITION)
 *   - Smaller per-partition indexes
 *
 * Partitions created: FY 2025-26 through FY 2035-36 (11 years).
 * A default partition catches any data beyond this range.
 * Add new partitions before FY 2036-37 if the system is still in use.
 */
export class CreateBankTransfersTable1832000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create partitioned parent table using raw SQL
    // Primary key must include partition column for partitioned tables
    await queryRunner.query(`
      CREATE TABLE bank_transfers (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "partyType" varchar(20) NOT NULL,
        "invoiceId" uuid,
        "bookPaymentId" uuid,
        "siteId" uuid NOT NULL,
        "contractorId" uuid,
        "vendorId" uuid,
        "poId" uuid NOT NULL,
        "utrNumber" varchar(100) NOT NULL,
        "transferDate" date NOT NULL,
        "transferAmount" decimal(15, 2) NOT NULL,
        "financialYear" varchar(10) NOT NULL,
        "proofFileKey" varchar(500),
        "proofFileName" varchar(255),
        "remarks" text,
        "approvalStatus" varchar(20) NOT NULL DEFAULT 'APPROVED',
        "approvalBy" uuid,
        "approvalAt" timestamptz,
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" timestamptz,
        PRIMARY KEY ("id", "financialYear")
      ) PARTITION BY RANGE ("financialYear")
    `);

    // Create partitions for next 10 financial years
    // Indian FY: April-March, e.g., FY 2025-26 = '2526'
    const financialYears = [
      '2526', '2627', '2728', '2829', '2930',
      '3031', '3132', '3233', '3334', '3435', '3536',
    ];
    for (const fy of financialYears) {
      const nextFy = String(Number(fy) + 101).padStart(4, '0'); // 2526 -> 2627
      await queryRunner.query(`
        CREATE TABLE bank_transfers_${fy} PARTITION OF bank_transfers
        FOR VALUES FROM ('${fy}') TO ('${nextFy}')
      `);
    }
    // Default partition for values beyond 10 years (safety net)
    await queryRunner.query(`
      CREATE TABLE bank_transfers_default PARTITION OF bank_transfers DEFAULT
    `);

    // Indexes (automatically created on all partitions in PG 11+)
    await queryRunner.query(`
      CREATE INDEX "IDX_BANK_TRANSFER_PARTY_TYPE" ON bank_transfers ("partyType")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_BANK_TRANSFER_INVOICE" ON bank_transfers ("invoiceId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_BANK_TRANSFER_BOOK_PAYMENT" ON bank_transfers ("bookPaymentId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_BANK_TRANSFER_SITE" ON bank_transfers ("siteId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_BANK_TRANSFER_UTR" ON bank_transfers ("utrNumber")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_BANK_TRANSFER_PO" ON bank_transfers ("poId")
    `);

    // Partial unique index for PURCHASE side 1:1 with book payment
    // Must include partition key for partitioned tables
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_BANK_TRANSFER_BOOK_PAYMENT"
      ON bank_transfers ("bookPaymentId", "financialYear")
      WHERE "deletedAt" IS NULL AND "bookPaymentId" IS NOT NULL
    `);

    // CHECK constraint: partyType determines which FK is set
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT chk_bank_transfer_party CHECK (
        ("partyType" = 'SALE' AND "invoiceId" IS NOT NULL AND "bookPaymentId" IS NULL AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "bookPaymentId" IS NOT NULL AND "invoiceId" IS NULL AND "vendorId" IS NOT NULL AND "contractorId" IS NULL)
      )
    `);

    // Foreign keys (on partitioned tables, these are inherited by partitions)
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_invoiceId"
      FOREIGN KEY ("invoiceId") REFERENCES site_invoices(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_bookPaymentId"
      FOREIGN KEY ("bookPaymentId") REFERENCES book_payments(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_siteId"
      FOREIGN KEY ("siteId") REFERENCES sites(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_poId"
      FOREIGN KEY ("poId") REFERENCES purchase_orders(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_contractorId"
      FOREIGN KEY ("contractorId") REFERENCES contractors(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_vendorId"
      FOREIGN KEY ("vendorId") REFERENCES vendors(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_createdBy"
      FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_updatedBy"
      FOREIGN KEY ("updatedBy") REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_deletedBy"
      FOREIGN KEY ("deletedBy") REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE bank_transfers
      ADD CONSTRAINT "FK_bank_transfers_approvalBy"
      FOREIGN KEY ("approvalBy") REFERENCES users(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      COMMENT ON TABLE bank_transfers IS 'Partitioned by financialYear (FY 2025-26 to 2035-36). Default partition catches overflow.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping parent table automatically drops all partitions
    await queryRunner.query(`DROP TABLE IF EXISTS bank_transfers CASCADE`);
  }
}
