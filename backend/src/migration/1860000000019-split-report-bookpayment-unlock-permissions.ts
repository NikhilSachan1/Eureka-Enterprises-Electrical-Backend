import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits the combined `.unlock` permission (from migration 1860000000018) into two
 * separate permissions per module — one for GRANT, one for REJECT — matching the
 * frontend's permission model:
 *   financials.book-payments.unlock         → unlock-grant + unlock-request-reject
 *   financials.site-reports.unlock          → unlock-grant + unlock-request-reject
 * Seeds the 4 new permissions (idempotent), maps them to SUPER_ADMIN + ADMIN, and
 * removes the now-unused combined `.unlock` permissions.
 */
export class SplitReportBookPaymentUnlockPermissions1860000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Seed the 4 separate permissions (no-op if the FE already created them).
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ('financials.book-payments.unlock-grant',          'financials', 'Grant Book Payment Unlock',        'Permission to grant unlock access for book payments',  false, false, 'web'),
        ('financials.book-payments.unlock-request-reject', 'financials', 'Reject Book Payment Unlock Request','Permission to reject book payments unlock requests',    false, false, 'web'),
        ('financials.site-reports.unlock-grant',           'financials', 'Grant Site Reports Unlock',         'Permission to grant unlock access for site reports',   false, false, 'web'),
        ('financials.site-reports.unlock-request-reject',  'financials', 'Reject Site Report Unlock Request', 'Permission to reject site reports unlock requests',     false, false, 'web')
      ON CONFLICT DO NOTHING
    `);

    // 2. Map the new permissions to SUPER_ADMIN + ADMIN.
    await queryRunner.query(`
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
        AND p.name IN (
          'financials.book-payments.unlock-grant',
          'financials.book-payments.unlock-request-reject',
          'financials.site-reports.unlock-grant',
          'financials.site-reports.unlock-request-reject'
        )
        AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
    `);

    // 3. Remove the now-unused combined permissions + their role mappings.
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "permissionId" IN (
        SELECT id FROM permissions
        WHERE name IN ('financials.book-payments.unlock', 'financials.site-reports.unlock')
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions
      WHERE name IN ('financials.book-payments.unlock', 'financials.site-reports.unlock')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the combined permissions.
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

    // Remove the separate permissions + mappings.
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "permissionId" IN (
        SELECT id FROM permissions
        WHERE name IN (
          'financials.book-payments.unlock-grant',
          'financials.book-payments.unlock-request-reject',
          'financials.site-reports.unlock-grant',
          'financials.site-reports.unlock-request-reject'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions
      WHERE name IN (
        'financials.book-payments.unlock-grant',
        'financials.book-payments.unlock-request-reject',
        'financials.site-reports.unlock-grant',
        'financials.site-reports.unlock-request-reject'
      )
    `);
  }
}
