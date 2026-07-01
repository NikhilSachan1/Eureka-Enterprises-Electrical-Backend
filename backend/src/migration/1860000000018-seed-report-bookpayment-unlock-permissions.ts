import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unlock-grant/reject permissions for the new Site Report & Book Payment unlock
 * workflow. Mirrors financials.jmcs.unlock. Mapped to SUPER_ADMIN + ADMIN.
 * (unlock-request itself is gated by the existing .update permission.)
 */
export class SeedReportBookPaymentUnlockPermissions1860000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ('financials.site-reports.unlock',  'financials', 'Grant Unlock Requests for Site Reports',  'Grant or reject unlock requests for site reports',  false, false, 'web'),
        ('financials.book-payments.unlock', 'financials', 'Grant Unlock Requests for Book Payments', 'Grant or reject unlock requests for book payments', false, false, 'web')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
        AND p.name IN ('financials.site-reports.unlock', 'financials.book-payments.unlock')
        AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "permissionId" IN (
        SELECT id FROM permissions
        WHERE name IN ('financials.site-reports.unlock', 'financials.book-payments.unlock')
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions
      WHERE name IN ('financials.site-reports.unlock', 'financials.book-payments.unlock')
    `);
  }
}
