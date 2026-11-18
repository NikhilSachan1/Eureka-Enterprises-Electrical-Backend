import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PermissionEntity } from 'src/modules/permissions/entities/permission.entity';
import { RolePermissionEntity } from 'src/modules/role-permissions/entities/role-permission.entity';
import { UserPermissionEntity } from 'src/modules/user-permissions/entities/user-permission.entity';
import { RoleEntity } from 'src/modules/roles/entities/role.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/required-permission.decorator';
import { UserFromRequest } from '../auth.types';

/**
 * Authorizes routes annotated with @RequiredPermission(...).
 *
 * Resolution order for each required permission:
 *   1. user_permission_overrides — explicit grant or deny on this user
 *      (deny wins over everything; explicit grant satisfies the requirement)
 *   2. role_permissions — granted via the user's active role
 *
 * If a user lacks the permission via both paths, a 403 ForbiddenException is
 * thrown naming the missing key.
 *
 * Public routes (@Public) bypass this guard.
 *
 * The AuthGuard MUST run before this guard so that request.user is populated.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermRepo: Repository<RolePermissionEntity>,
    @InjectRepository(UserPermissionEntity)
    private readonly userPermRepo: Repository<UserPermissionEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // @RequiredAnyPermission: at least one of the keys (checked first, on its own).
    const anyOf = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (anyOf && anyOf.length > 0) {
      await this.assertAnyPermission(context.switchToHttp().getRequest().user, anyOf);
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      // No permission requirement on this route — defer to AuthGuard's auth check
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserFromRequest = request.user;
    if (!user) throw new UnauthorizedException();

    const permissions = await this.permissionRepo.find({
      where: { name: In(required), deletedAt: IsNull() },
    });

    // If a required key is missing from the permissions table, fail closed.
    // Rationale: a typo'd key in code MUST NOT silently allow access.
    const foundNames = new Set(permissions.map((p) => p.name));
    const missingFromDb = required.filter((k) => !foundNames.has(k));
    if (missingFromDb.length > 0) {
      throw new ForbiddenException(
        `Required permission(s) not registered in the system: ${missingFromDb.join(', ')}`,
      );
    }

    const permIds = permissions.map((p) => p.id);

    // Resolve active role
    const activeRole = await this.roleRepo.findOne({
      where: { name: user.activeRole, deletedAt: IsNull() },
    });
    if (!activeRole) {
      throw new ForbiddenException(`Active role not recognised: ${user.activeRole}`);
    }

    const [userOverrides, rolePerms] = await Promise.all([
      this.userPermRepo.find({
        where: {
          userId: user.id,
          permissionId: In(permIds),
          deletedAt: IsNull(),
        },
      }),
      this.rolePermRepo.find({
        where: {
          roleId: activeRole.id,
          permissionId: In(permIds),
          isActive: true,
          deletedAt: IsNull(),
        },
      }),
    ]);

    const overrideMap = new Map<string, boolean>(
      userOverrides.map((o) => [o.permissionId, o.isGranted]),
    );
    const rolePermSet = new Set<string>(rolePerms.map((r) => r.permissionId));

    for (const perm of permissions) {
      const override = overrideMap.get(perm.id);
      if (override === false) {
        throw new ForbiddenException(`Permission explicitly denied for this user: ${perm.name}`);
      }
      if (override === true) continue;
      if (rolePermSet.has(perm.id)) continue;
      throw new ForbiddenException(`Missing permission: ${perm.name}`);
    }

    return true;
  }

  /**
   * Passes when the user holds at least one of the keys, through the active role or a user
   * grant, and that key is not explicitly denied for the user. Unregistered keys are ignored;
   * with none registered the request is refused.
   */
  private async assertAnyPermission(
    user: UserFromRequest | undefined,
    keys: string[],
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();

    const permissions = await this.permissionRepo.find({
      where: { name: In(keys), deletedAt: IsNull() },
    });
    if (permissions.length === 0) {
      throw new ForbiddenException(
        `Required permission(s) not registered in the system: ${keys.join(', ')}`,
      );
    }

    const activeRole = await this.roleRepo.findOne({
      where: { name: user.activeRole, deletedAt: IsNull() },
    });
    if (!activeRole) {
      throw new ForbiddenException(`Active role not recognised: ${user.activeRole}`);
    }

    const permIds = permissions.map((p) => p.id);
    const [userOverrides, rolePerms] = await Promise.all([
      this.userPermRepo.find({
        where: { userId: user.id, permissionId: In(permIds), deletedAt: IsNull() },
      }),
      this.rolePermRepo.find({
        where: {
          roleId: activeRole.id,
          permissionId: In(permIds),
          isActive: true,
          deletedAt: IsNull(),
        },
      }),
    ]);

    const overrideMap = new Map<string, boolean>(
      userOverrides.map((o) => [o.permissionId, o.isGranted]),
    );
    const rolePermSet = new Set<string>(rolePerms.map((r) => r.permissionId));

    const holdsOne = permissions.some((perm) => {
      const override = overrideMap.get(perm.id);
      if (override === false) return false;
      return override === true || rolePermSet.has(perm.id);
    });
    if (!holdsOne) {
      throw new ForbiddenException(
        `Missing permission: one of ${[...new Set(permissions.map((p) => p.name))].join(', ')}`,
      );
    }
  }
}
