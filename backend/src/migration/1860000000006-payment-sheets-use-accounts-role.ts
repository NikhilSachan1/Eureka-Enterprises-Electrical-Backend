import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consolidate payment-sheet processing onto the pre-existing ACCOUNTS role and remove the
 * redundant ACCOUNTANT role introduced in 1860000000002. The org already had ACCOUNTS.
 */

const PROCESS_PERMS = [
  'financials.payment-sheets.process',
  'financials.payment-sheets.view',
  'financials.payment-sheets.download',
];

const flowWith = (processingRole: string) => [
  { stage: 'INITIATION', role: 'OPERATION_MANAGER', amountEdit: 'free', addRemove: false },
  {
    stage: 'HR_REVIEW',
    role: 'HR',
    amountEdit: 'free',
    addRemove: false,
    canReturn: true,
    canReject: true,
  },
  {
    stage: 'ADMIN_REVIEW',
    role: 'ADMIN',
    amountEdit: 'decrease-only',
    addRemove: true,
    canReturn: true,
    canReject: true,
  },
  {
    stage: 'PROCESSING',
    role: processingRole,
    amountEdit: 'none',
    addRemove: false,
    processItems: true,
  },
];

export class PaymentSheetsUseAccountsRole1860000000006 implements MigrationInterface {
  private async setApprovalFlow(queryRunner: QueryRunner, value: unknown): Promise<void> {
    await queryRunner.query(
      `
      UPDATE config_settings cs
      SET value = $1::jsonb, "updatedAt" = NOW()
      FROM configurations c
      WHERE c.id = cs."configId" AND c.key = 'payments.approval_flow' AND cs."deletedAt" IS NULL
      `,
      [JSON.stringify(value)],
    );
  }

  private async mapPerms(queryRunner: QueryRunner, roleName: string): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name = $1 AND p.name = ANY($2) AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
      `,
      [roleName, PROCESS_PERMS],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Point the approval flow's PROCESSING stage at ACCOUNTS.
    await this.setApprovalFlow(queryRunner, flowWith('ACCOUNTS'));

    // 2. Grant the processing permissions to ACCOUNTS.
    await this.mapPerms(queryRunner, 'ACCOUNTS');

    // 3. Drop the ACCOUNTANT role's payment-sheet permission mappings.
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "roleId" IN (SELECT id FROM roles WHERE name = 'ACCOUNTANT')
        AND "permissionId" IN (SELECT id FROM permissions WHERE name LIKE 'financials.payment-sheets.%')
    `);

    // 4. Remove the ACCOUNTANT role itself — only if no users are assigned to it.
    await queryRunner.query(`
      DELETE FROM roles
      WHERE name = 'ACCOUNTANT'
        AND id NOT IN (SELECT "roleId" FROM user_roles)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate ACCOUNTANT and revert.
    await queryRunner.query(`
      INSERT INTO roles (name, label, description, "isEditable", "isDeletable")
      VALUES ('ACCOUNTANT', 'Accountant', 'Processes approved payment sheets (pay/hold/reject)', false, false)
      ON CONFLICT (name) DO NOTHING
    `);
    await this.mapPerms(queryRunner, 'ACCOUNTANT');
    await this.setApprovalFlow(queryRunner, flowWith('ACCOUNTANT'));
    // Remove the ACCOUNTS processing mappings added by up().
    await queryRunner.query(
      `
      DELETE FROM role_permissions
      WHERE "roleId" IN (SELECT id FROM roles WHERE name = 'ACCOUNTS')
        AND "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))
    `,
      [PROCESS_PERMS],
    );
  }
}
