import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permission for POST /auth/impersonate/:userId, granted to SUPER_ADMIN only.
 *
 * AuthService also requires the SUPER_ADMIN role, so granting this to another role on the
 * permission screen shows them the action but the server still refuses it.
 *
 * Idempotent: NOT EXISTS on the permission, ON CONFLICT DO NOTHING on the grant.
 */
export class SeedAuthImpersonatePermission1860000000090 implements MigrationInterface {
  name = 'SeedAuthImpersonatePermission1860000000090';

  private static readonly PERMISSION = 'auth.impersonate';
  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const name = SeedAuthImpersonatePermission1860000000090.PERMISSION;

    await queryRunner.query(
      `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
       SELECT $1, 'auth', 'Login as User', 'Sign in as another user without their password', true, true, 'web'
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
      [SeedAuthImpersonatePermission1860000000090.GRANT_TO_ROLES, name],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const name = SeedAuthImpersonatePermission1860000000090.PERMISSION;

    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = $1)`,
      [name],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [name]);
  }
}
