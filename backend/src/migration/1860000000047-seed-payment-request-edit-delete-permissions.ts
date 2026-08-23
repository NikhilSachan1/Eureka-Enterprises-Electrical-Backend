import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the edit/delete permissions for Payment Requests, added alongside the PATCH and DELETE
 * endpoints. Follows the same shape as 1860000000037 (which seeded view-list/create/approve).
 *
 * Role → permission assignment is out of scope and done via the role-permissions admin UI.
 * PermissionsGuard fails closed, so both endpoints return 403 until someone grants these.
 * Idempotent (NOT EXISTS guard — `permissions.name` is not unique).
 */
export class SeedPaymentRequestEditDeletePermissions1860000000047 implements MigrationInterface {
  private readonly permissions: Array<[string, string, string]> = [
    [
      'financials.payment-requests.update',
      'Edit Payment Request',
      'Edit a payment request while it is still pending',
    ],
    [
      'financials.payment-requests.delete',
      'Delete Payment Request',
      'Delete a payment request while it is still pending',
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
