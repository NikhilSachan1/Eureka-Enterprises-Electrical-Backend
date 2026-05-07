import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BRD §10 — every role EXCEPT Employee and Driver gets the cross-site
 * Universal Financial View. The previous migration only granted ADMIN /
 * SUPERADMIN every financial permission; this one extends READ-ONLY
 * financial access (view-level + universal-view) to the remaining roles.
 *
 * Roles that already have full access (ADMIN, SUPERADMIN) are unaffected
 * because of the ON CONFLICT clause on (roleId, permissionId).
 *
 * What gets granted to non-Employee, non-Driver roles:
 *   - financials.universal-view  (the dashboard's BRD §10 entry point)
 *   - financials.purchase-orders.view
 *   - financials.jmcs.view
 *   - financials.site-reports.view
 *   - financials.invoices.view
 *   - financials.book-payments.view
 *   - financials.bank-transfers.view
 *   - financials.payment-advices.view
 *   - financials.notes.view
 *   - financials.gst.view
 *   - financials.tds.view
 *   - financials.billing.view
 *   - financials.vendors.view
 *
 * Edit / approve / release-payment permissions stay restricted to ADMIN /
 * SUPERADMIN as already seeded by 1836000000002.
 */
export class SeedUniversalViewRolePermissions1836000000003 implements MigrationInterface {
  private static readonly READ_PERMISSIONS = [
    'financials.universal-view',
    'financials.purchase-orders.view',
    'financials.jmcs.view',
    'financials.site-reports.view',
    'financials.invoices.view',
    'financials.book-payments.view',
    'financials.bank-transfers.view',
    'financials.payment-advices.view',
    'financials.notes.view',
    'financials.gst.view',
    'financials.tds.view',
    'financials.billing.view',
    'financials.vendors.view',
  ];

  // BRD §10: universal-view accessible to everyone except Employee and Driver
  private static readonly EXCLUDED_ROLES = ['EMPLOYEE', 'DRIVER', 'employee', 'driver'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roles = await queryRunner.query(
      `
        SELECT id, name FROM roles
         WHERE "deletedAt" IS NULL
           AND name <> ALL($1)
      `,
      [SeedUniversalViewRolePermissions1836000000003.EXCLUDED_ROLES],
    );

    if (roles.length === 0) {
      console.log(
        '[1836000000003] No eligible roles found for universal-view grant. Skipping.',
      );
      return;
    }

    const permissions = await queryRunner.query(
      `SELECT id, name FROM permissions WHERE name = ANY($1) AND "deletedAt" IS NULL`,
      [SeedUniversalViewRolePermissions1836000000003.READ_PERMISSIONS],
    );

    if (permissions.length === 0) {
      console.log(
        '[1836000000003] No read-level financial permissions found. ' +
          'Run 1836000000001-seed-financial-permissions first.',
      );
      return;
    }

    let inserted = 0;
    for (const role of roles) {
      for (const permission of permissions) {
        const result = await queryRunner.query(
          `
            INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt", "updatedAt")
            VALUES (uuid_generate_v4(), $1, $2, NOW(), NOW())
            ON CONFLICT ("roleId", "permissionId") DO NOTHING
            RETURNING id
          `,
          [role.id, permission.id],
        );
        if (result.length > 0) inserted++;
      }
    }

    console.log(
      `[1836000000003] Granted read-level financial permissions to ${roles.length} non-Employee/Driver roles ` +
        `(${inserted} new mappings inserted).`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const roles = await queryRunner.query(
      `
        SELECT id FROM roles
         WHERE name <> ALL($1)
           AND name NOT IN ('ADMIN', 'SUPERADMIN', 'admin', 'superadmin')
      `,
      [SeedUniversalViewRolePermissions1836000000003.EXCLUDED_ROLES],
    );

    const permissions = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = ANY($1)`,
      [SeedUniversalViewRolePermissions1836000000003.READ_PERMISSIONS],
    );

    if (roles.length === 0 || permissions.length === 0) return;

    const roleIds = roles.map((r: any) => r.id);
    const permissionIds = permissions.map((p: any) => p.id);

    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "roleId" = ANY($1) AND "permissionId" = ANY($2)`,
      [roleIds, permissionIds],
    );
  }
}
