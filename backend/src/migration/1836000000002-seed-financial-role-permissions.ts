import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grant all financial permissions to ADMIN and SUPERADMIN roles.
 */
export class SeedFinancialRolePermissions1836000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get ADMIN and SUPERADMIN role IDs
    const roles = await queryRunner.query(
      `SELECT id, name FROM roles WHERE name IN ('ADMIN', 'SUPERADMIN', 'admin', 'superadmin')`,
    );

    if (roles.length === 0) {
      console.log('No ADMIN or SUPERADMIN roles found. Skipping role-permission seeding.');
      return;
    }

    // Get all financial permissions
    const permissions = await queryRunner.query(
      `SELECT id, name FROM permissions WHERE module IN ('financials', 'sites') AND name LIKE 'financials.%' OR name = 'sites.close'`,
    );

    if (permissions.length === 0) {
      console.log('No financial permissions found. Run the permissions seed first.');
      return;
    }

    // Create role-permission mappings
    for (const role of roles) {
      for (const permission of permissions) {
        await queryRunner.query(
          `
            INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt", "updatedAt")
            VALUES (uuid_generate_v4(), $1, $2, NOW(), NOW())
            ON CONFLICT ("roleId", "permissionId") DO NOTHING
          `,
          [role.id, permission.id],
        );
      }
    }

    console.log(`Granted ${permissions.length} permissions to ${roles.length} roles.`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get role IDs
    const roles = await queryRunner.query(
      `SELECT id FROM roles WHERE name IN ('ADMIN', 'SUPERADMIN', 'admin', 'superadmin')`,
    );

    // Get financial permission IDs
    const permissions = await queryRunner.query(
      `SELECT id FROM permissions WHERE module IN ('financials', 'sites') AND name LIKE 'financials.%' OR name = 'sites.close'`,
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
