import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImpersonatedByToAuditLogs1860000000089 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "request_audit_logs" ADD COLUMN IF NOT EXISTS "impersonatedBy" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "entity_audit_logs" ADD COLUMN IF NOT EXISTS "impersonatedBy" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "entity_audit_logs" DROP COLUMN IF EXISTS "impersonatedBy"`);
    await queryRunner.query(
      `ALTER TABLE "request_audit_logs" DROP COLUMN IF EXISTS "impersonatedBy"`,
    );
  }
}
