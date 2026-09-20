import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permission for the manual advance-settlement endpoints on an invoice.
 *
 * Settlement used to happen by itself when an invoice was approved, so it needed no permission of
 * its own. It is now an explicit operator action — deciding which advance clears which invoice is
 * a business judgement — and gets its own gate rather than riding on `invoices.update`, because
 * editing an invoice and deciding where a vendor's advance money lands are different authorities.
 *
 * Granted to the same roles as the rest of the advance-payment module.
 *
 * Idempotent: NOT EXISTS per permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedAdvanceSettlePermission1860000000066 implements MigrationInterface {
  name = 'SeedAdvanceSettlePermission1860000000066';

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATION_MANAGER'];

  private readonly permissions: Array<[string, string, string]> = [
    [
      'financials.advance-payments.settle',
      'Settle Advance Payments',
      'Settle an advance payment against an approved invoice, and reverse a settlement',
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
      [SeedAdvanceSettlePermission1860000000066.GRANT_TO_ROLES, names],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = this.permissions.map(([name]) => name);
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
