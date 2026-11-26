import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Export (PDF) permissions for the Ledger menu, separate from viewing:
 *   ledger.contractor.export — GET /site-invoices/ledger/contractor/pdf
 *   ledger.vendor.export     — GET /site-invoices/ledger/vendor/pdf
 *
 * Granted to SUPER_ADMIN only; give it to other roles from the permission screen.
 *
 * Idempotent: NOT EXISTS on each permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedLedgerExportPermissions1860000000100 implements MigrationInterface {
  name = 'SeedLedgerExportPermissions1860000000100';

  private static readonly MODULE = 'ledger';
  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN'];
  private static readonly PERMISSIONS = [
    {
      name: 'ledger.contractor.export',
      label: 'export contractor ledger',
      description: 'Download the contractor (sale) invoice ledger as a PDF',
    },
    {
      name: 'ledger.vendor.export',
      label: 'export vendor ledger',
      description: 'Download the vendor (purchase) invoice ledger as a PDF',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const { MODULE, GRANT_TO_ROLES, PERMISSIONS } = SeedLedgerExportPermissions1860000000100;

    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, $2, $3, $4, true, true, 'web'
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
        [permission.name, MODULE, permission.label, permission.description],
      );
    }

    await queryRunner.query(
      `INSERT INTO role_permissions ("roleId", "permissionId")
       SELECT r.id, p.id
         FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = ANY($1)
          AND r."deletedAt" IS NULL
          AND p.name = ANY($2)
          AND p."deletedAt" IS NULL
       ON CONFLICT DO NOTHING`,
      [GRANT_TO_ROLES, PERMISSIONS.map((p) => p.name)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = SeedLedgerExportPermissions1860000000100.PERMISSIONS.map((p) => p.name);

    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
