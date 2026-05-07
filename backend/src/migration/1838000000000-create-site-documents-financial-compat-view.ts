import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates a compatibility view that makes the analytics module's existing
 * queries work after site_documents lost its financial columns
 * (direction, totalAmount, paymentStatus, documentType, gstAmount) in
 * migration 1835000000000.
 *
 * The analytics module references `sd.direction`, `sd.totalAmount`, etc.
 * against `site_documents sd`. This view — named `site_documents_financial` —
 * exposes the same column set by projecting from the new financial tables
 * (site_invoices, purchase_orders).
 *
 * The analytics queries need one change each: replace the FROM / JOIN target
 * from `site_documents` to `site_documents_financial`. That change is tracked
 * in analytics.queries.ts (updated separately).
 *
 * Column mapping:
 *   site_invoices rows → direction = SALE→RECEIVABLE, PURCHASE→PAYABLE
 *                      → documentType = INVOICE
 *                      → paymentStatus = paidTotal >= totalAmount ? PAID : PENDING
 *   purchase_orders rows → documentType = PO
 *                       → paymentStatus = APPROVED ? PAID : PENDING
 */
export class CreateSiteDocumentsFinancialCompatView1838000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW site_documents_financial AS
      SELECT
        si.id,
        si."siteId",
        si."contractorId",
        si."vendorId",
        CASE WHEN si."partyType" = 'SALE' THEN 'RECEIVABLE' ELSE 'PAYABLE' END AS direction,
        si."totalAmount",
        COALESCE(si."gstAmount", 0)                                            AS "gstAmount",
        CASE
          WHEN si."paidTotal" IS NOT NULL AND si."paidTotal" >= si."totalAmount" THEN 'PAID'
          ELSE 'PENDING'
        END                                                                     AS "paymentStatus",
        'INVOICE'                                                               AS "documentType",
        si."invoiceNumber"                                                      AS "documentNumber",
        NULL::date                                                              AS "dueDate",
        si."invoiceDate"                                                        AS "documentDate",
        si."deletedAt"
      FROM site_invoices si
      WHERE si."deletedAt" IS NULL

      UNION ALL

      SELECT
        po.id,
        po."siteId",
        po."contractorId",
        po."vendorId",
        CASE WHEN po."partyType" = 'SALE' THEN 'RECEIVABLE' ELSE 'PAYABLE' END AS direction,
        po."totalAmount",
        COALESCE(po."gstAmount", 0)                                             AS "gstAmount",
        CASE
          WHEN po."approvalStatus" = 'APPROVED' THEN 'PAID'
          ELSE 'PENDING'
        END                                                                      AS "paymentStatus",
        'PO'                                                                     AS "documentType",
        po."poNumber"                                                            AS "documentNumber",
        NULL::date                                                               AS "dueDate",
        po."poDate"                                                              AS "documentDate",
        po."deletedAt"
      FROM purchase_orders po
      WHERE po."deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS site_documents_financial`);
  }
}
