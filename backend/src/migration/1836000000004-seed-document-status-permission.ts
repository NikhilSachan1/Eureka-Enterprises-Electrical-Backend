import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the Document Status view permission and grant it to all roles
 * except EMPLOYEE and DRIVER (same access policy as other view-level
 * financial permissions per BRD §10).
 */
export class SeedDocumentStatusPermission1836000000004 implements MigrationInterface {
  private static readonly PERMISSION_NAME = 'financials.document-status.view';
  private static readonly EXCLUDED_ROLES = ['EMPLOYEE', 'DRIVER', 'employee', 'driver'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert the permission (idempotent)
    await queryRunner.query(
      `
        INSERT INTO permissions (id, name, label, module, "createdAt", "updatedAt")
        VALUES (uuid_generate_v4(), $1, $2, $3, NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `,
      [
        SeedDocumentStatusPermission1836000000004.PERMISSION_NAME,
        'View Document Status',
        'financials',
      ],
    );

    // 2. Load the permission ID (may have already existed before this migration)
    const [perm] = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = $1 AND "deletedAt" IS NULL`,
      [SeedDocumentStatusPermission1836000000004.PERMISSION_NAME],
    );

    if (!perm) {
        return;
    }

    // 3. Grant to all roles except EMPLOYEE and DRIVER
    const roles = await queryRunner.query(
      `SELECT id, name FROM roles WHERE "deletedAt" IS NULL AND name <> ALL($1)`,
      [SeedDocumentStatusPermission1836000000004.EXCLUDED_ROLES],
    );

    if (roles.length === 0) {
      return;
    }

    let inserted = 0;
    for (const role of roles) {
      const result = await queryRunner.query(
        `
          INSERT INTO role_permissions (id, "roleId", "permissionId", "isActive", "createdAt", "updatedAt")
          VALUES (uuid_generate_v4(), $1, $2, true, NOW(), NOW())
          ON CONFLICT ("roleId", "permissionId") DO NOTHING
          RETURNING id
        `,
        [role.id, perm.id],
      );
      if (result.length > 0) inserted++;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [perm] = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = $1`,
      [SeedDocumentStatusPermission1836000000004.PERMISSION_NAME],
    );

    if (!perm) return;

    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "permissionId" = $1`,
      [perm.id],
    );

    await queryRunner.query(
      `DELETE FROM permissions WHERE id = $1`,
      [perm.id],
    );
  }
}
