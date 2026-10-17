import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Roles } from 'src/modules/roles/constants/role.constants';
import {
  DelegatableModule,
  ManageScope,
  MODULE_APPROVE_PERMISSION,
  MODULE_SCOPE_CONFIG_KEY,
  USER_DELEGATION_ERRORS,
} from './constants/user-delegation.constants';

/** Roles that already see the whole company and are not narrowed by any of this. */
const OFFICE_ROLES: string[] = [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.HR, Roles.OPERATION_MANAGER];

/**
 * Whose rows may this person touch, for this module.
 *
 * The one place that answers it. Before this, the rule lived as a hardcoded role check inside two
 * copies of an interceptor — one in expense, one in fuel — which is how they came to be able to
 * disagree. Both now ask here.
 *
 * The answer is a list of user ids, or `null` meaning "no restriction". `null` rather than "every
 * id in the company" on purpose: the callers turn it into a SQL filter, and a missing filter is
 * both faster and honest about there being no limit.
 */
@Injectable()
export class ManagedUsersService {
  private readonly logger = new Logger(ManagedUsersService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * The configured scope for a module.
   *
   * Anything unreadable or unrecognised falls back to `SELF`. A scope that cannot be read must
   * narrow, never widen — the failure mode of a missing config row should be "you see less than
   * you should", not "you see everybody's money".
   */
  async scopeFor(module: DelegatableModule): Promise<ManageScope> {
    const key = MODULE_SCOPE_CONFIG_KEY[module];
    if (!key) return ManageScope.SELF;
    try {
      const [row] = await this.dataSource.query(
        `SELECT cs."value"
           FROM configurations c
           JOIN config_settings cs ON cs."configId" = c."id" AND cs."isActive" = true
          WHERE c."key" = $1 AND c."deletedAt" IS NULL AND cs."deletedAt" IS NULL
          ORDER BY cs."createdAt" DESC
          LIMIT 1`,
        [key],
      );
      const raw = typeof row?.value === 'string' ? row.value.replace(/^"|"$/g, '') : row?.value;
      const value = String(raw ?? '').trim();
      return (Object.values(ManageScope) as string[]).includes(value)
        ? (value as ManageScope)
        : ManageScope.SELF;
    } catch (error) {
      this.logger.warn(`Scope config for ${module} unreadable, staying at self: ${error}`);
      return ManageScope.SELF;
    }
  }

  /** The members this manager currently holds for a module, excluding himself. */
  private async delegatedMemberIds(
    managerId: string,
    module: DelegatableModule,
  ): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT d."memberId"
         FROM user_module_delegations d
         JOIN users u ON u."id" = d."memberId" AND u."deletedAt" IS NULL AND u."status" = 'ACTIVE'
        WHERE d."managerId" = $1
          AND d."module" = $2
          AND d."deletedAt" IS NULL
          AND d."effectiveFrom" <= CURRENT_DATE
          AND (d."effectiveTo" IS NULL OR d."effectiveTo" >= CURRENT_DATE)`,
      [managerId, module],
    );
    return rows.map((r: { memberId: string }) => r.memberId);
  }

  /**
   * Whose rows this person may touch.
   *
   * `null` means no restriction. Otherwise the list always contains the caller — nobody is ever
   * delegated away from their own entries.
   */
  async resolveManagedUserIds(
    userId: string,
    activeRole: string,
    module: DelegatableModule,
  ): Promise<string[] | null> {
    if (OFFICE_ROLES.includes(activeRole)) return null;

    const scope = await this.scopeFor(module);
    if (scope === ManageScope.ALL) return null;
    if (scope === ManageScope.SELF) return [userId];

    const members = await this.delegatedMemberIds(userId, module);
    return [userId, ...members.filter((id) => id !== userId)];
  }

  /**
   * Refuse unless this person may act for that one.
   *
   * Thrown as Forbidden rather than returned as a boolean so no caller can forget to check the
   * result — the one failure mode that would quietly let someone file another person's expenses.
   */
  async assertCanActFor(
    actorId: string,
    activeRole: string,
    module: DelegatableModule,
    targetUserId: string,
  ): Promise<void> {
    if (actorId === targetUserId) return;
    const allowed = await this.resolveManagedUserIds(actorId, activeRole, module);
    if (allowed === null) return;
    if (!allowed.includes(targetUserId)) {
      throw new ForbiddenException(
        USER_DELEGATION_ERRORS.NOT_ALLOWED_FOR_USER.replace('{module}', module),
      );
    }
  }

  /**
   * Does this person hold a permission — by role grant or by per-user override?
   *
   * Mirrors `PermissionsGuard` exactly, including that an override of `false` beats the role
   * grant. Reimplemented here rather than reused because the guard answers a route; this answers
   * a question in the middle of a transaction.
   */
  async hasPermission(userId: string, activeRole: string, permission: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT
         BOOL_OR(o."isGranted" IS TRUE)                              AS "grantedByOverride",
         BOOL_OR(o."isGranted" IS FALSE)                             AS "deniedByOverride",
         BOOL_OR(rp."id" IS NOT NULL)                                AS "grantedByRole"
       FROM permissions p
       LEFT JOIN user_permission_overrides o
              ON o."permissionId" = p."id" AND o."userId" = $1 AND o."deletedAt" IS NULL
       LEFT JOIN roles r
              ON r."name" = $2 AND r."deletedAt" IS NULL
       LEFT JOIN role_permissions rp
              ON rp."permissionId" = p."id" AND rp."roleId" = r."id"
             AND rp."isActive" = true AND rp."deletedAt" IS NULL
       WHERE p."name" = $3 AND p."deletedAt" IS NULL`,
      [userId, activeRole, permission],
    );
    if (!row) return false;
    if (row.deniedByOverride) return false;
    return Boolean(row.grantedByOverride || row.grantedByRole);
  }

  /**
   * Should a forced entry land approved?
   *
   * Only for someone who could have approved it anyway. For every role that holds `force` today
   * this is true, so nothing changes for them; it is the per-user override — one already exists
   * on dev — that this closes.
   */
  async forcedEntryIsPreApproved(
    userId: string,
    activeRole: string,
    module: DelegatableModule,
  ): Promise<boolean> {
    return this.hasPermission(userId, activeRole, MODULE_APPROVE_PERMISSION[module]);
  }

  /** The people this person may file for, named, for a filter dropdown. */
  async listManagedUsers(userId: string, activeRole: string, module: DelegatableModule) {
    const allowed = await this.resolveManagedUserIds(userId, activeRole, module);
    const rows = await this.dataSource.query(
      `SELECT u."id", u."employeeId", u."designation",
              TRIM(CONCAT_WS(' ', u."firstName", u."lastName")) AS "name",
              (u."id" = $1) AS "isSelf"
         FROM users u
        WHERE u."deletedAt" IS NULL
          AND u."status" = 'ACTIVE'
          AND ($2::uuid[] IS NULL OR u."id" = ANY($2::uuid[]))
        ORDER BY (u."id" = $1) DESC, "name"`,
      [userId, allowed],
    );
    return {
      module,
      /** `all` when nothing narrows this person — the office roles. */
      scope: allowed === null ? ManageScope.ALL : await this.scopeFor(module),
      users: rows,
    };
  }
}
