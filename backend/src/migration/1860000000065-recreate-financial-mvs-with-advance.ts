import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recreates both financial materialized views so advances are visible in them (phase 4).
 *
 * `mv_site_financial_summary` gains per-PO `advancePaid` and `unsettledAdvance`;
 * `mv_universal_financial_view` gains the aggregate `totalAdvancePaid` and `totalUnsettledAdvance`.
 *
 * `totalPendingBilling` is deliberately left as `invoicedTotal − paidTotal`. Advances are reported
 * beside it rather than folded into it, so the figure stays ≥ 0 and keeps meaning "billed but not
 * yet paid" — an advance is the opposite case, paid but not yet billed.
 *
 * `unsettledAdvance` is read from `advance_payments` rather than derived from the PO rollup,
 * because settlement moves `settledAmount` on the advance and never touches the PO. Approved only,
 * matching the rollup.
 *
 * No data migration: these are views over live tables, refreshed every 5 minutes by
 * RefreshFinancialMaterializedViews. DROP + CREATE is required because a materialized view's
 * column list cannot be altered in place. Indexes are recreated identically.
 */
export class RecreateFinancialMvsWithAdvance1860000000065 implements MigrationInterface {
  name = 'RecreateFinancialMvsWithAdvance1860000000065';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_site_financial_summary`);
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_site_financial_summary AS
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
        po."advancePaidTotal" as "advancePaid",
        COALESCE((
          SELECT SUM(ap.amount - ap."settledAmount")
          FROM advance_payments ap
          WHERE ap."poId" = po.id
            AND ap."approvalStatus" = 'APPROVED'
            AND ap."deletedAt" IS NULL
        ), 0) as "unsettledAdvance",
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
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_site_financial_summary_po
         ON mv_site_financial_summary ("poId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_mv_site_financial_summary_site
         ON mv_site_financial_summary ("siteId")`,
    );

    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_universal_financial_view`);
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_universal_financial_view AS
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
        SUM(po."advancePaidTotal") as "totalAdvancePaid",
        COALESCE(SUM((
          SELECT SUM(ap.amount - ap."settledAmount")
          FROM advance_payments ap
          WHERE ap."poId" = po.id
            AND ap."approvalStatus" = 'APPROVED'
            AND ap."deletedAt" IS NULL
        )), 0) as "totalUnsettledAdvance",
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
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_universal_financial_view_pk
         ON mv_universal_financial_view ("siteId", "partyType", "partyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_mv_universal_financial_view_site
         ON mv_universal_financial_view ("siteId")`,
    );
  }

  /**
   * Recreates the pre-advance definitions, so a rollback leaves the views exactly as migration
   * 1837000000000 built them.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_site_financial_summary`);
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_site_financial_summary AS
      SELECT
        po.id as "poId", po."siteId", po."partyType", po."poNumber",
        COALESCE(c.name, v.name) as "partyName",
        po."totalAmount" as "poTotal", po."invoicedTotal", po."bookedTotal", po."paidTotal",
        (po."totalAmount" - po."invoicedTotal") as "uninvoiced",
        (po."invoicedTotal" - po."paidTotal") as "pendingBilling",
        COALESCE((SELECT SUM(inv."gstAmount") FROM site_invoices inv
                   WHERE inv."poId" = po.id AND inv."approvalStatus" = 'APPROVED'
                     AND inv."deletedAt" IS NULL), 0) as "gstCut",
        COALESCE((SELECT SUM(inv."tdsAmount") FROM site_invoices inv
                   WHERE inv."poId" = po.id AND inv."approvalStatus" = 'APPROVED'
                     AND inv."deletedAt" IS NULL), 0) as "tdsCut",
        po."createdAt", po."updatedAt"
      FROM purchase_orders po
      LEFT JOIN contractors c ON po."contractorId" = c.id
      LEFT JOIN vendors v ON po."vendorId" = v.id
      WHERE po."deletedAt" IS NULL
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_site_financial_summary_po
         ON mv_site_financial_summary ("poId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_mv_site_financial_summary_site
         ON mv_site_financial_summary ("siteId")`,
    );

    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_universal_financial_view`);
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_universal_financial_view AS
      SELECT
        po."siteId", s.name as "siteName", s."companyId", po."partyType",
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
      WHERE po."deletedAt" IS NULL AND s."deletedAt" IS NULL
      GROUP BY po."siteId", s.name, s."companyId", po."partyType",
               COALESCE(po."contractorId", po."vendorId"), COALESCE(c.name, v.name)
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_universal_financial_view_pk
         ON mv_universal_financial_view ("siteId", "partyType", "partyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_mv_universal_financial_view_site
         ON mv_universal_financial_view ("siteId")`,
    );
  }
}
