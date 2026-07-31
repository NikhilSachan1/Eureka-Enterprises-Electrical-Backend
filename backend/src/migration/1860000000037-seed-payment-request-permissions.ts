import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed permissions for the Payment Request feature. Role → permission assignment is out of scope
 * (done via the role-permissions admin UI). PermissionsGuard fails closed, so until granted, the
 * endpoints return 403. Idempotent (NOT EXISTS guard — `permissions.name` is not unique).
 */
export class SeedPaymentRequestPermissions1860000000037 implements MigrationInterface {
  private readonly permissions: Array<[string, string, string]> = [
    ['financials.payment-requests.view-list', 'List Payment Requests', 'List payment requests'],
    ['financials.payment-requests.create', 'Create Payment Request', 'Raise a payment request'],
    [
      'financials.payment-requests.approve',
      'Approve Payment Request',
      'Approve/reject a payment request (creates a book payment on approval)',
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
