import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCompanyBankAccountPermissions1860000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ('financials.company-bank-accounts.create', 'financials', 'Create Company Bank Accounts', 'Add company bank accounts (source of funds)', false, false, 'web'),
        ('financials.company-bank-accounts.view',   'financials', 'View Company Bank Accounts',   'View the company bank account list',          false, false, 'web'),
        ('financials.company-bank-accounts.update', 'financials', 'Update Company Bank Accounts', 'Edit or set-default company bank accounts',   false, false, 'web'),
        ('financials.company-bank-accounts.delete', 'financials', 'Delete Company Bank Accounts', 'Delete unused company bank accounts',         false, false, 'web')
      ON CONFLICT DO NOTHING
    `);

    const map: Array<{ roles: string[]; perms: string[] }> = [
      {
        roles: ['SUPER_ADMIN', 'ADMIN'],
        perms: [
          'financials.company-bank-accounts.create',
          'financials.company-bank-accounts.view',
          'financials.company-bank-accounts.update',
          'financials.company-bank-accounts.delete',
        ],
      },
      { roles: ['ACCOUNTS'], perms: ['financials.company-bank-accounts.view'] },
    ];

    for (const { roles, perms } of map) {
      await queryRunner.query(
        `
        INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
        SELECT r.id, p.id, true
        FROM roles r, permissions p
        WHERE r.name = ANY($1) AND p.name = ANY($2) AND r."deletedAt" IS NULL
        ON CONFLICT DO NOTHING
        `,
        [roles, perms],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "permissionId" IN (SELECT id FROM permissions WHERE name LIKE 'financials.company-bank-accounts.%')
    `);
    await queryRunner.query(
      `DELETE FROM permissions WHERE name LIKE 'financials.company-bank-accounts.%'`,
    );
  }
}
