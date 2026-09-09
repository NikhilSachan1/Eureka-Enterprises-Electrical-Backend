import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the permissions for site-vendor assignment.
 *
 * `/sites/:id/vendors` previously had NO permission decorator at all — any
 * authenticated user could assign or unassign vendors on any site. Adding
 * @RequiredPermission closes that hole, but PermissionsGuard fails closed, so the
 * routes would 403 for everyone until someone granted the new permissions.
 *
 * To avoid breaking existing admin flows on deploy, this grants all three to
 * SUPER_ADMIN and ADMIN here. Every other role — including whichever system role
 * the site Project Managers hold — must be granted via the role-permissions admin
 * UI, matching how 1860000000047 left role assignment out of scope.
 *
 * Note the narrowing to "PM of this specific site" is NOT done by the permission:
 * 'Project Manager' is a site_allocations.role value, not a system role, so it
 * cannot be a grantee. The service-level site-allocation check does that part.
 *
 * Idempotent: NOT EXISTS guard on insert (permissions.name is not unique) and
 * ON CONFLICT on the role grant.
 */
export class SeedSiteVendorPermissions1860000000050 implements MigrationInterface {
  private readonly permissions: Array<[string, string, string]> = [
    ['financials.site-vendors.view', 'View Site Vendors', 'List the vendors linked to a site'],
    [
      'financials.site-vendors.assign',
      'Assign Site Vendors',
      'Link vendors to a site — restricted to the site Project Manager',
    ],
    [
      'financials.site-vendors.unassign',
      'Unassign Site Vendors',
      'Unlink vendors from a site — restricted to the site Project Manager',
    ],
  ];

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN'];

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
      [SeedSiteVendorPermissions1860000000050.GRANT_TO_ROLES, names],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = this.permissions.map(([name]) => name);
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
