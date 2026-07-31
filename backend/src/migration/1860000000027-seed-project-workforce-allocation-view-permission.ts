import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the "view workforce allocation table" permission for the Project module.
 *
 * Backs the employee allocation overview endpoint (GET /site-allocations/employees).
 *
 * This migration ONLY manages the permission row. Role → permission ASSIGNMENT is out of
 * scope (handled via the role-permissions admin UI). NOTE: until this permission is granted
 * to the appropriate role, the endpoint returns 403 for everyone, because PermissionsGuard
 * fails closed.
 */
export class SeedProjectWorkforceAllocationViewPermission1860000000027
  implements MigrationInterface
{
  private readonly permissionName = 'project.workforce-allocation.view-list';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `permissions.name` has only a non-unique index, so ON CONFLICT can't dedupe here.
    // Guard with NOT EXISTS to stay idempotent on re-run.
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      SELECT
        'project.workforce-allocation.view-list',
        'project',
        'Table View Project Workforce Allocation',
        'Able to see workforce allocation table',
        true,
        true,
        'web'
      WHERE NOT EXISTS (
        SELECT 1 FROM permissions WHERE name = 'project.workforce-allocation.view-list'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove role grants referencing this permission, then the permission itself.
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = $1)`,
      [this.permissionName],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [this.permissionName]);
  }
}
