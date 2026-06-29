import { MigrationInterface, QueryRunner } from 'typeorm';

const APPROVAL_FLOW = [
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
    role: 'ACCOUNTANT',
    amountEdit: 'none',
    addRemove: false,
    processItems: true,
  },
];

export class SeedPaymentSheetConfigs1860000000003 implements MigrationInterface {
  private async seed(
    queryRunner: QueryRunner,
    key: string,
    label: string,
    valueType: string,
    description: string,
    value: unknown,
  ): Promise<void> {
    // Note: configurations.key has only a plain index (no unique constraint) in the DB,
    // so ON CONFLICT (key) cannot be used — guard with NOT EXISTS instead.
    await queryRunner.query(
      `
      INSERT INTO configurations (module, key, label, "valueType", "isEditable", description)
      SELECT 'payments', $1, $2, $3, true, $4
      WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1)
      `,
      [key, label, valueType, description],
    );

    await queryRunner.query(
      `
      INSERT INTO config_settings ("configId", "contextKey", value, "isActive")
      SELECT c.id, NULL, $2::jsonb, true
      FROM configurations c
      WHERE c.key = $1
        AND NOT EXISTS (
          SELECT 1 FROM config_settings cs WHERE cs."configId" = c.id AND cs."deletedAt" IS NULL
        )
      `,
      [key, JSON.stringify(value)],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.seed(
      queryRunner,
      'payments.approval_flow',
      'Payment Sheet Approval Flow',
      'array',
      'Ordered approval chain for payment sheets (configurable hierarchy)',
      APPROVAL_FLOW,
    );
    await this.seed(
      queryRunner,
      'payments.sheet_number_format',
      'Payment Sheet Number Format',
      'text',
      'Sheet number format; {FY} = financial year, {seq} = zero-padded sequence',
      'PS/{FY}/{seq}',
    );
    await this.seed(
      queryRunner,
      'payments.admin_edit_policy',
      'Payment Sheet Admin Edit Policy',
      'text',
      'Amount-edit policy applied at the ADMIN_REVIEW stage',
      'decrease-only',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM config_settings
      WHERE "configId" IN (
        SELECT id FROM configurations
        WHERE key IN ('payments.approval_flow', 'payments.sheet_number_format', 'payments.admin_edit_policy')
      )
    `);
    await queryRunner.query(`
      DELETE FROM configurations
      WHERE key IN ('payments.approval_flow', 'payments.sheet_number_format', 'payments.admin_edit_policy')
    `);
  }
}
