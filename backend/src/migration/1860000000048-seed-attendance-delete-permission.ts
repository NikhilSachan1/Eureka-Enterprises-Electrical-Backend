import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the `attendance.delete` permission for the new DELETE /attendance/:id endpoint.
 *
 * The rest of the attendance controller is protected only by the global AuthGuard, but deleting
 * reverses food-allowance ledger entries and leave balances, so it is gated like the financial
 * endpoints instead. PermissionsGuard fails closed — the endpoint returns 403 until this is
 * granted to a role via the role-permissions admin UI.
 *
 * Idempotent (NOT EXISTS guard — `permissions.name` is not unique).
 */
export class SeedAttendanceDeletePermission1860000000048 implements MigrationInterface {
  name = 'SeedAttendanceDeletePermission1860000000048';

  private readonly permission: [string, string, string] = [
    'attendance.delete',
    'delete attendance',
    'Delete an attendance record and reverse the food allowance and leave it caused',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [name, label, description] = this.permission;
    await queryRunner.query(
      `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
       SELECT $1, 'attendance', $2, $3, true, true, 'web'
       WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
      [name, label, description],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [name] = this.permission;
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = $1)`,
      [name],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [name]);
  }
}
