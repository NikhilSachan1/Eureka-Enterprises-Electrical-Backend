import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the tds_register_entries table with PARTITION BY RANGE (financialYear).
 *
 * Plan §3.4 hardening #7 — partitioning enables:
 *   - Fast queries scoped to a single financial year (partition pruning)
 *   - Easy archival of old years (DROP PARTITION)
 *   - Smaller per-partition indexes
 *
 * Each invoice creates a TDS entry, so this table grows with transaction volume.
 * Partitioning by financial year keeps each partition manageable.
 *
 * Partitions created: FY 2025-26 through FY 2035-36 (11 years).
 * A default partition catches any data beyond this range.
 */
export class CreateTdsRegisterEntriesTable1834000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create partitioned parent table
    // Primary key must include partition column for partitioned tables
    await queryRunner.query(`
      CREATE TABLE tds_register_entries (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId" uuid NOT NULL,
        "siteId" uuid NOT NULL,
        "partyType" varchar(20) NOT NULL,
        "contractorId" uuid,
        "vendorId" uuid,
        "invoiceMonth" char(7) NOT NULL,
        "financialYear" varchar(10) NOT NULL,
        "taxableAmount" decimal(15, 2) NOT NULL,
        "tdsAmount" decimal(15, 2) NOT NULL,
        "isVerified" boolean NOT NULL DEFAULT false,
        "verifiedAt" timestamptz,
        "verifiedBy" uuid,
        "tdsPaymentId" uuid,
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
        CREATE TABLE tds_register_entries_${fy} PARTITION OF tds_register_entries
        FOR VALUES FROM ('${fy}') TO ('${nextFy}')
      `);
    }
    // Default partition for values beyond 10 years (safety net)
    await queryRunner.query(`
      CREATE TABLE tds_register_entries_default PARTITION OF tds_register_entries DEFAULT
    `);

    // Indexes (automatically propagated to partitions in PG 11+)
    // Unique index on invoiceId must include partition key
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_TDS_REG_INVOICE"
      ON tds_register_entries ("invoiceId", "financialYear")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_TDS_REG_SITE" ON tds_register_entries ("siteId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_TDS_REG_PARTY_TYPE" ON tds_register_entries ("partyType")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_TDS_REG_MONTH" ON tds_register_entries ("invoiceMonth")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_TDS_REG_VENDOR_MONTH" ON tds_register_entries ("vendorId", "invoiceMonth")
      WHERE "vendorId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_TDS_REG_CONTRACTOR_MONTH" ON tds_register_entries ("contractorId", "invoiceMonth")
      WHERE "contractorId" IS NOT NULL
    `);

    // Foreign keys
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_invoiceId"
      FOREIGN KEY ("invoiceId") REFERENCES site_invoices(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_siteId"
      FOREIGN KEY ("siteId") REFERENCES sites(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_contractorId"
      FOREIGN KEY ("contractorId") REFERENCES contractors(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_vendorId"
      FOREIGN KEY ("vendorId") REFERENCES vendors(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_createdBy"
      FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_updatedBy"
      FOREIGN KEY ("updatedBy") REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_deletedBy"
      FOREIGN KEY ("deletedBy") REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tds_register_entries
      ADD CONSTRAINT "FK_tds_register_entries_verifiedBy"
      FOREIGN KEY ("verifiedBy") REFERENCES users(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      COMMENT ON TABLE tds_register_entries IS 'Partitioned by financialYear (FY 2025-26 to 2035-36). Default partition catches overflow.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tds_register_entries CASCADE`);
  }
}
