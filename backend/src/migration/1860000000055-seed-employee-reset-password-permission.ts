import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the permission for the admin-set password reset
 * (POST /auth/users/:userId/reset-password).
 *
 * Named under the existing `employee` module to sit beside `employee.send-password-link` and
 * `employee.edit`, since it is an employee-management action rather than an auth-flow one.
 *
 * Granted to SUPER_ADMIN and ADMIN here so the feature is usable on deploy. HR, Operation Manager
 * and anyone else must be granted it through the role-permissions admin UI — PermissionsGuard fails
 * closed, so they get 403 until then. That is the one manual step.
 *
 * The permission alone does not decide who can be reset: the service additionally requires the
 * *target* to hold only EMPLOYEE / DRIVER roles, so a permission holder cannot reset a privileged
 * account and sign in as them.
 *
 * Idempotent: NOT EXISTS on the permission, ON CONFLICT DO NOTHING on the grant.
 */
export class SeedEmployeeResetPasswordPermission1860000000055 implements MigrationInterface {
  name = 'SeedEmployeeResetPasswordPermission1860000000055';

  private static readonly PERMISSION = 'employee.reset-password';
  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR', 'OPERATION_MANAGER'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const name = SeedEmployeeResetPasswordPermission1860000000055.PERMISSION;

    await queryRunner.query(
      `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
       SELECT $1, 'employee', 'Reset Employee Password',
              'Set an employee or driver password directly and share it with them. Cannot target privileged accounts.',
              true, true, 'web'
       WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
      [name],
    );

    await queryRunner.query(
      `INSERT INTO role_permissions ("roleId", "permissionId")
       SELECT r.id, p.id
         FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = ANY($1)
          AND r."deletedAt" IS NULL
          AND p.name = $2
          AND p."deletedAt" IS NULL
       ON CONFLICT DO NOTHING`,
      [SeedEmployeeResetPasswordPermission1860000000055.GRANT_TO_ROLES, name],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const name = SeedEmployeeResetPasswordPermission1860000000055.PERMISSION;
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = $1)`,
      [name],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [name]);
  }
}
