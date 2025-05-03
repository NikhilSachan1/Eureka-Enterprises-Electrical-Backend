import { MigrationInterface, QueryRunner } from 'typeorm';
import { UtilityService } from '../utils/utility/utility.service';

export class CreateDefaultAdminUser1740378371609 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const utilityService = new UtilityService();
    const hashedPassword = utilityService.createHash('Admin@123');

    const result = await queryRunner.query(
      `
            INSERT INTO users (
                "firstName",
                "lastName",
                email,
                password,
                "contactNumber",
                "profilePicture",
                status,
                "createdAt",
                "updatedAt"
            )
            VALUES (
                'Admin',
                'User',
                'akhil.sachan@coditas.com',
                $1,
                '+1234567890',
                NULL,
                'ACTIVE',
                NOW(),
                NOW()
            )
            RETURNING id
        `,
      [hashedPassword],
    );

    const adminUserId = result[0].id;

    const adminRole = await queryRunner.query(`
            SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1
        `);
    const adminRoleId = adminRole[0].id;

    await queryRunner.query(
      `
            INSERT INTO user_roles ("userId", "roleId")
            VALUES ($1, $2)
        `,
      [adminUserId, adminRoleId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM user_roles
            WHERE "userId" = (SELECT id FROM users WHERE email = 'admin@realqualified.com')
        `);

    await queryRunner.query(`
            DELETE FROM users WHERE email = 'admin@realqualified.com'
        `);
  }
}
