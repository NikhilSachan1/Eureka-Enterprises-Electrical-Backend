import { MigrationInterface, QueryRunner } from 'typeorm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

export class AddIsSystemUserFlag1850000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "isSystemUser" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(
      `
      UPDATE users SET "isSystemUser" = true WHERE id = $1
    `,
      [SYSTEM_USER_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS "isSystemUser"
    `);
  }
}
