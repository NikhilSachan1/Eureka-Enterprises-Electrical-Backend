import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSystemUser1777000000000 implements MigrationInterface {
  private readonly SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingUser = await queryRunner.query(`SELECT id FROM users WHERE id = $1`, [
      this.SYSTEM_USER_ID,
    ]);

    if (existingUser.length > 0) {
      return;
    }

    await queryRunner.query(
      `INSERT INTO users (
        id,
        "firstName",
        "lastName",
        email,
        password,
        status,
        "employeeId",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1,
        'System',
        'User',
        'system@internal.com',
        'NOT_A_VALID_PASSWORD_HASH',
        'SYSTEM',
        'SYSTEM',
        NOW(),
        NOW()
      )`,
      [this.SYSTEM_USER_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM users WHERE id = $1`, [this.SYSTEM_USER_ID]);
  }
}
