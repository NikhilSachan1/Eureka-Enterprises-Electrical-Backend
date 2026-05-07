import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create materialized views for financial summaries per §7.5 of the plan.
 */
export class CreateFinancialMaterializedViews1837000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // mv_site_financial_summary — feeds BRD §8 PO-wise summary
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_site_financial_summary AS
      SELECT
        po.id as "poId",
        po."siteId",
        po."partyType",
        po."poNumber",
        COALESCE(c.name, v.name) as "partyName",
        po."totalAmount" as "poTotal",
        po."invoicedTotal",
        po."bookedTotal",
        po."paidTotal",
        (po."totalAmount" - po."invoicedTotal") as "uninvoiced",
        (po."invoicedTotal" - po."paidTotal") as "pendingBilling",
        COALESCE((
          SELECT SUM(inv."gstAmount")
          FROM site_invoices inv
          WHERE inv."poId" = po.id
            AND inv."approvalStatus" = 'APPROVED'
            AND inv."deletedAt" IS NULL
        ), 0) as "gstCut",
        COALESCE((
          SELECT SUM(inv."tdsAmount")
          FROM site_invoices inv
          WHERE inv."poId" = po.id
            AND inv."approvalStatus" = 'APPROVED'
            AND inv."deletedAt" IS NULL
        ), 0) as "tdsCut",
        po."createdAt",
        po."updatedAt"
      FROM purchase_orders po
      LEFT JOIN contractors c ON po."contractorId" = c.id
      LEFT JOIN vendors v ON po."vendorId" = v.id
      WHERE po."deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_site_financial_summary_po
      ON mv_site_financial_summary ("poId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_site_financial_summary_site
      ON mv_site_financial_summary ("siteId")
    `);

    // mv_universal_financial_view — feeds BRD §10 Universal View
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_universal_financial_view AS
      SELECT
        po."siteId",
        s.name as "siteName",
        s."companyId",
        po."partyType",
        COALESCE(po."contractorId", po."vendorId") as "partyId",
        COALESCE(c.name, v.name) as "partyName",
        COUNT(DISTINCT po.id) as "poCount",
        SUM(po."totalAmount") as "totalPOAmount",
        SUM(po."invoicedTotal") as "totalInvoiced",
        SUM(po."bookedTotal") as "totalBooked",
        SUM(po."paidTotal") as "totalPaid",
        SUM(po."totalAmount" - po."invoicedTotal") as "totalUninvoiced",
        SUM(po."invoicedTotal" - po."paidTotal") as "totalPendingBilling",
        MAX(po."lastInvoiceAt") as "lastInvoiceAt",
        MAX(po."lastPaymentAt") as "lastPaymentAt",
        NOW() as "refreshedAt"
      FROM purchase_orders po
      JOIN sites s ON po."siteId" = s.id
      LEFT JOIN contractors c ON po."contractorId" = c.id
      LEFT JOIN vendors v ON po."vendorId" = v.id
      WHERE po."deletedAt" IS NULL
        AND s."deletedAt" IS NULL
      GROUP BY
        po."siteId",
        s.name,
        s."companyId",
        po."partyType",
        COALESCE(po."contractorId", po."vendorId"),
        COALESCE(c.name, v.name)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_universal_financial_view_pk
      ON mv_universal_financial_view ("siteId", "partyType", "partyId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_universal_financial_view_company
      ON mv_universal_financial_view ("companyId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_universal_financial_view`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_site_financial_summary`);
  }
}
