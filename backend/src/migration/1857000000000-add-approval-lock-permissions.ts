import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalLockPermissions1857000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert 3 new permissions
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ('financials.site-reports.approve',  'financials', 'Approve Site Reports',       'Approve or reject site reports',      false, false, 'web'),
        ('financials.book-payments.approve', 'financials', 'Approve Book Payments',      'Approve or reject book payments',     false, false, 'web'),
        ('financials.bank-transfers.lock',   'financials', 'Lock/Unlock Bank Transfers', 'Lock or unlock bank transfers',       false, false, 'web')
      ON CONFLICT DO NOTHING
    `);

    // Assign to SUPER_ADMIN and ADMIN roles
    await queryRunner.query(`
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
        AND p.name IN (
          'financials.site-reports.approve',
          'financials.book-payments.approve',
          'financials.bank-transfers.lock'
        )
        AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "permissionId" IN (
        SELECT id FROM permissions
        WHERE name IN (
          'financials.site-reports.approve',
          'financials.book-payments.approve',
          'financials.bank-transfers.lock'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM permissions
      WHERE name IN (
        'financials.site-reports.approve',
        'financials.book-payments.approve',
        'financials.bank-transfers.lock'
      )
    `);
  }
}
