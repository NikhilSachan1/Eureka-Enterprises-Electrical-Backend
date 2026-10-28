import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Who should hear about something, worked out from permissions rather than a hard-coded admin
 * (notification requirements v7: "permission-based recipients").
 *
 * A user holds a permission when any of their roles grants it, or they have an explicit grant
 * override — and no explicit deny override, which wins over both. The same rules as
 * `PermissionsGuard`, except that every role counts, not only the one active in a session: a
 * notification is not tied to a login.
 */
@Injectable()
export class NotificationRecipientsService {
  private readonly logger = new Logger(NotificationRecipientsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Active users holding `permission`. Empty (never throws) if the lookup fails. */
  async usersWithPermission(permission: string): Promise<string[]> {
    try {
      const rows: Array<{ id: string }> = await this.dataSource.query(
        `SELECT u."id"
           FROM users u
          WHERE u."deletedAt" IS NULL AND u."status" = 'ACTIVE'
            AND (
              EXISTS (SELECT 1
                        FROM user_roles ur
                        JOIN roles r ON r."id" = ur."roleId" AND r."deletedAt" IS NULL
                        JOIN role_permissions rp ON rp."roleId" = ur."roleId"
                             AND rp."isActive" AND rp."deletedAt" IS NULL
                        JOIN permissions p ON p."id" = rp."permissionId" AND p."deletedAt" IS NULL
                       WHERE ur."userId" = u."id" AND ur."deletedAt" IS NULL AND p."name" = $1)
              OR EXISTS (SELECT 1
                           FROM user_permission_overrides o
                           JOIN permissions p ON p."id" = o."permissionId" AND p."deletedAt" IS NULL
                          WHERE o."userId" = u."id" AND o."deletedAt" IS NULL
                            AND o."isGranted" AND p."name" = $1)
            )
            AND NOT EXISTS (SELECT 1
                              FROM user_permission_overrides o
                              JOIN permissions p ON p."id" = o."permissionId" AND p."deletedAt" IS NULL
                             WHERE o."userId" = u."id" AND o."deletedAt" IS NULL
                               AND o."isGranted" = false AND p."name" = $1)`,
        [permission],
      );
      return rows.map((r) => r.id);
    } catch (error) {
      this.logger.warn(`Recipients for "${permission}" not resolved: ${error?.message ?? error}`);
      return [];
    }
  }
}
