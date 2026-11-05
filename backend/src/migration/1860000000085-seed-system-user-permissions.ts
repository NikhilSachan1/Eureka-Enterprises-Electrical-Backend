import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions for the /system-users endpoints, granted to SUPER_ADMIN, ADMIN, HR and
 * OPERATION_MANAGER. Other roles get them through the role-permissions admin UI; PermissionsGuard
 * fails closed until then.
 *
 * Idempotent: NOT EXISTS on the permissions, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedSystemUserPermissions1860000000085 implements MigrationInterface {
  name = 'SeedSystemUserPermissions1860000000085';

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR', 'OPERATION_MANAGER'];

  private static readonly PERMISSIONS = [
    {
      name: 'system-user.view',
      label: 'View System Users',
      description: 'View the list and details of system users',
    },
    {
      name: 'system-user.add',
      label: 'Add System User',
      description: 'Create a login-only user with no salary, leave balance or payroll',
    },
    {
      name: 'system-user.edit',
      label: 'Edit System User',
      description: 'Update or archive a system user',
    },
    {
      name: 'system-user.delete',
      label: 'Delete System User',
      description: 'Delete an archived system user',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { name, label, description } of SeedSystemUserPermissions1860000000085.PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, 'system-user', $2, $3, true, true, 'web'
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
        [name, label, description],
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
      [
        SeedSystemUserPermissions1860000000085.GRANT_TO_ROLES,
        SeedSystemUserPermissions1860000000085.PERMISSIONS.map((p) => p.name),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = SeedSystemUserPermissions1860000000085.PERMISSIONS.map((p) => p.name);

    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
