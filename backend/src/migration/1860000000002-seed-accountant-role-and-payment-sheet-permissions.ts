import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAccountantRoleAndPaymentSheetPermissions1860000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. New ACCOUNTANT role
    await queryRunner.query(`
      INSERT INTO roles (name, label, description, "isEditable", "isDeletable")
      VALUES ('ACCOUNTANT', 'Accountant', 'Processes approved payment sheets (pay/hold/reject)', false, false)
      ON CONFLICT (name) DO NOTHING
    `);

    // 2. Payment-sheet permissions
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ('financials.payment-sheets.create',       'financials', 'Create Payment Sheets',  'Create and submit payment sheets',          false, false, 'web'),
        ('financials.payment-sheets.review',        'financials', 'Review Payment Sheets',  'HR review: edit, forward, return, reject',  false, false, 'web'),
        ('financials.payment-sheets.admin-review',  'financials', 'Admin Payment Sheets',   'Admin review: decrease, add/remove, forward',false, false, 'web'),
        ('financials.payment-sheets.process',       'financials', 'Process Payment Sheets', 'Accountant: pay, hold, release, reject',     false, false, 'web'),
        ('financials.payment-sheets.view',          'financials', 'View Payment Sheets',    'View payment sheets',                       false, false, 'web'),
        ('financials.payment-sheets.download',      'financials', 'Download Payment Sheets','Download payment sheet PDF',                false, false, 'web')
      ON CONFLICT DO NOTHING
    `);

    // 3. Map permissions to roles
    const map: Array<{ roles: string[]; perms: string[] }> = [
      {
        roles: ['OPERATION_MANAGER'],
        perms: [
          'financials.payment-sheets.create',
          'financials.payment-sheets.view',
          'financials.payment-sheets.download',
        ],
      },
      {
        roles: ['HR'],
        perms: [
          'financials.payment-sheets.review',
          'financials.payment-sheets.view',
          'financials.payment-sheets.download',
        ],
      },
      {
        roles: ['ADMIN', 'SUPER_ADMIN'],
        perms: [
          'financials.payment-sheets.admin-review',
          'financials.payment-sheets.view',
          'financials.payment-sheets.download',
        ],
      },
      {
        roles: ['ACCOUNTANT'],
        perms: [
          'financials.payment-sheets.process',
          'financials.payment-sheets.view',
          'financials.payment-sheets.download',
        ],
      },
    ];

    for (const { roles, perms } of map) {
      await queryRunner.query(
        `
        INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
        SELECT r.id, p.id, true
        FROM roles r, permissions p
        WHERE r.name = ANY($1)
          AND p.name = ANY($2)
          AND r."deletedAt" IS NULL
        ON CONFLICT DO NOTHING
        `,
        [roles, perms],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "permissionId" IN (
        SELECT id FROM permissions WHERE name LIKE 'financials.payment-sheets.%'
      )
    `);
    await queryRunner.query(
      `DELETE FROM permissions WHERE name LIKE 'financials.payment-sheets.%'`,
    );
    // NOTE: We intentionally do NOT delete the ACCOUNTANT role or its user_roles here.
    // The role pre-exists in some environments (e.g. production) with real users assigned;
    // up() only inserts it idempotently (ON CONFLICT DO NOTHING) and maps permissions onto it.
    // Deleting it on rollback would destroy pre-existing data this migration never created.
    // Removing the payment-sheet permission rows above already revokes everything up() granted.
  }
}
