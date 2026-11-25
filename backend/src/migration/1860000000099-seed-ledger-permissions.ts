import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separate permissions for the Ledger menu:
 *   ledger.contractor.view — Contractor ledger (GET /site-invoices/ledger/contractor)
 *   ledger.vendor.view     — Vendor ledger     (GET /site-invoices/ledger/vendor)
 *
 * The ledger used to open with `financials.invoices.view-list`, so every role that holds that
 * permission gets both new ones — nobody loses access. Grant or revoke them per role from the
 * permission screen afterwards.
 *
 * Idempotent: NOT EXISTS on each permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedLedgerPermissions1860000000099 implements MigrationInterface {
  name = 'SeedLedgerPermissions1860000000099';

  private static readonly MODULE = 'ledger';
  private static readonly GRANT_LIKE = 'financials.invoices.view-list';
  private static readonly PERMISSIONS = [
    {
      name: 'ledger.contractor.view',
      label: 'view contractor ledger',
      description: 'Open the contractor (sale) invoice ledger',
    },
    {
      name: 'ledger.vendor.view',
      label: 'view vendor ledger',
      description: 'Open the vendor (purchase) invoice ledger',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const { MODULE, GRANT_LIKE, PERMISSIONS } = SeedLedgerPermissions1860000000099;

    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, $2, $3, $4, true, true, 'web'
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
        [permission.name, MODULE, permission.label, permission.description],
      );
    }

    // Same roles that can see the invoice list today.
    await queryRunner.query(
      `INSERT INTO role_permissions ("roleId", "permissionId")
       SELECT existing."roleId", p.id
         FROM role_permissions existing
         JOIN permissions source ON source.id = existing."permissionId"
                                AND source.name = $1
                                AND source."deletedAt" IS NULL
        CROSS JOIN permissions p
        WHERE existing."deletedAt" IS NULL
          AND existing."isActive" = true
          AND p.name = ANY($2)
          AND p."deletedAt" IS NULL
       ON CONFLICT DO NOTHING`,
      [GRANT_LIKE, PERMISSIONS.map((p) => p.name)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = SeedLedgerPermissions1860000000099.PERMISSIONS.map((p) => p.name);

    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
