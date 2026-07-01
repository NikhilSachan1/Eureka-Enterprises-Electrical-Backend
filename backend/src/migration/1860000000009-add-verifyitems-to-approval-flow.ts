import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flag the HR_REVIEW and ADMIN_REVIEW stages of payments.approval_flow with
 * verifyItems: true, so per-line verification is required to forward from them.
 */
const flow = (verify: boolean) => [
  { stage: 'INITIATION', role: 'OPERATION_MANAGER', amountEdit: 'free', addRemove: false },
  {
    stage: 'HR_REVIEW',
    role: 'HR',
    amountEdit: 'free',
    addRemove: false,
    canReturn: true,
    canReject: true,
    ...(verify ? { verifyItems: true } : {}),
  },
  {
    stage: 'ADMIN_REVIEW',
    role: 'ADMIN',
    amountEdit: 'decrease-only',
    addRemove: true,
    canReturn: true,
    canReject: true,
    ...(verify ? { verifyItems: true } : {}),
  },
  {
    stage: 'PROCESSING',
    role: 'ACCOUNTS',
    amountEdit: 'none',
    addRemove: false,
    processItems: true,
  },
];

export class AddVerifyItemsToApprovalFlow1860000000009 implements MigrationInterface {
  private async setFlow(queryRunner: QueryRunner, value: unknown): Promise<void> {
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

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.setFlow(queryRunner, flow(true));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.setFlow(queryRunner, flow(false));
  }
}
