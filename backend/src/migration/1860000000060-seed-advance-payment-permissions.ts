import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions for the Advance Payment module, under the existing `financials` module alongside
 * `financials.purchase-orders.*` / `financials.invoices.*`.
 *
 * Granted to SUPER_ADMIN, ADMIN and OPERATION_MANAGER.
 *
 * "Site Project Manager" — the other role the user named — is deliberately **not** a grantee,
 * because it is not a system role at all: it is a `site_allocations.role` value, so it cannot be
 * a row in `roles`. It is handled the same way site-vendor assignment handles it — the permission
 * is granted coarsely and the *service* narrows it to the PM of that specific site via
 * checkSiteCreateAccess({ requirePm: true }). A user granted the permission but not allocated as
 * PM anywhere still cannot create an advance for a site.
 *
 * Idempotent: NOT EXISTS per permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedAdvancePaymentPermissions1860000000060 implements MigrationInterface {
  name = 'SeedAdvancePaymentPermissions1860000000060';

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATION_MANAGER'];

  private readonly permissions: Array<[string, string, string]> = [
    [
      'financials.advance-payments.view-list',
      'View Advance Payments',
      'List and view advance payments made against purchase orders',
    ],
    [
      'financials.advance-payments.create',
      'Create Advance Payment',
      'Record an advance paid to a vendor against a PO before any invoice exists',
    ],
    [
      'financials.advance-payments.update',
      'Edit Advance Payment',
      'Edit an advance payment while it has no book payment and is unsettled',
    ],
    [
      'financials.advance-payments.delete',
      'Delete Advance Payment',
      'Delete an advance payment while it has no book payment and is unsettled',
    ],
    [
      'financials.advance-payments.approve',
      'Approve Advance Payment',
      'Approve or reject an advance payment; only approved advances can be booked or settled',
    ],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, label, description] of this.permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, 'financials', $2, $3, true, true, 'web'
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
        [name, label, description],
      );
    }

    const names = this.permissions.map(([name]) => name);

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
      [SeedAdvancePaymentPermissions1860000000060.GRANT_TO_ROLES, names],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = this.permissions.map(([name]) => name);
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
