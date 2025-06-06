import { MigrationInterface, QueryRunner } from 'typeorm';
import { UtilityService } from '../utils/utility/utility.service';

export class CreateDefaultAdminUser1740378371609 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const utilityService = new UtilityService();
    const hashedPassword = utilityService.createHash('Admin@123');

    // Create first admin user (Akhil)
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
                'Akhil',
                'Sachan',
                'akhil.sachan@coditas.com',
                $1,
                '+918770882173',
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

    // Create System user
    const systemUserResult = await queryRunner.query(
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
                'System',
                'User',
                'system@coditas.com',
                $1,
                NULL,
                NULL,
                'ACTIVE',
                NOW(),
                NOW()
            )
            RETURNING id
        `,
      [hashedPassword],
    );

    const systemUserId = systemUserResult[0].id;

    const adminRole = await queryRunner.query(`
            SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1
        `);
    const adminRoleId = adminRole[0].id;

    // Assign admin role to both users
    await queryRunner.query(
      `
            INSERT INTO user_roles ("userId", "roleId")
            VALUES ($1, $2), ($3, $4)
        `,
      [adminUserId, adminRoleId, systemUserId, adminRoleId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove user roles for both users
    await queryRunner.query(`
            DELETE FROM user_roles
            WHERE "userId" IN (
                SELECT id FROM users WHERE email IN ('akhil.sachan@coditas.com', 'system@coditas.com')
            )
        `);

    // Delete both users
    await queryRunner.query(`
            DELETE FROM users WHERE email IN ('akhil.sachan@coditas.com', 'system@coditas.com')
        `);
  }
}
