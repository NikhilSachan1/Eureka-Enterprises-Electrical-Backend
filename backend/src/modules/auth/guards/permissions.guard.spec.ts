import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/required-permission.decorator';

// The guard only needs the entity classes as injection tokens; loading the real ones drags in
// the whole entity graph (and its circular imports).
jest.mock('src/modules/permissions/entities/permission.entity', () => ({
  PermissionEntity: class {},
}));
jest.mock('src/modules/role-permissions/entities/role-permission.entity', () => ({
  RolePermissionEntity: class {},
}));
jest.mock('src/modules/user-permissions/entities/user-permission.entity', () => ({
  UserPermissionEntity: class {},
}));
jest.mock('src/modules/roles/entities/role.entity', () => ({ RoleEntity: class {} }));

/**
 * PermissionsGuard: @RequiredPermission (all of) and @RequiredAnyPermission (one of).
 * Repositories are faked with plain lists; only ids and names matter here.
 */
describe('PermissionsGuard', () => {
  const ROLE = { id: 'role-emp', name: 'EMPLOYEE' };
  const PERMS = [
    { id: 'p-view', name: 'project.view-detail' },
    { id: 'p-edit', name: 'project.edit' },
    { id: 'p-ws', name: 'project.workspace' },
  ];

  let metadata: Record<string, unknown>;
  let rolePermIds: string[];
  let overrides: { permissionId: string; isGranted: boolean }[];
  let guard: PermissionsGuard;

  beforeEach(() => {
    metadata = {};
    rolePermIds = [];
    overrides = [];

    const reflector = {
      getAllAndOverride: (key: string) => metadata[key],
    } as unknown as Reflector;

    // `In([...])` arrives as a FindOperator; read its `_value` list.
    const inValues = (where: Record<string, { _value?: string[] }>, field: string) =>
      where[field]?._value ?? [];

    const permissionRepo = {
      find: jest.fn(async ({ where }) =>
        PERMS.filter((p) => inValues(where, 'name').includes(p.name)),
      ),
    };
    const roleRepo = {
      findOne: jest.fn(async ({ where }) => (where.name === ROLE.name ? ROLE : null)),
    };
    const rolePermRepo = {
      find: jest.fn(async ({ where }) =>
        rolePermIds
          .filter((id) => inValues(where, 'permissionId').includes(id))
          .map((permissionId) => ({ permissionId })),
      ),
    };
    const userPermRepo = {
      find: jest.fn(async ({ where }) =>
        overrides.filter((o) => inValues(where, 'permissionId').includes(o.permissionId)),
      ),
    };

    guard = new PermissionsGuard(
      reflector,
      permissionRepo as never,
      rolePermRepo as never,
      userPermRepo as never,
      roleRepo as never,
    );
  });

  const run = (user: unknown = { id: 'u1', activeRole: ROLE.name }) =>
    guard.canActivate({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext);

  it('lets a route with no permission metadata through', async () => {
    await expect(run()).resolves.toBe(true);
  });

  it('lets public routes through without a user', async () => {
    metadata[IS_PUBLIC_KEY] = true;
    metadata[ANY_PERMISSIONS_KEY] = ['project.edit'];
    await expect(run(null)).resolves.toBe(true);
  });

  describe('@RequiredAnyPermission', () => {
    beforeEach(() => {
      metadata[ANY_PERMISSIONS_KEY] = ['project.view-detail', 'project.edit'];
    });

    it('passes when the role has one of the keys', async () => {
      rolePermIds = ['p-edit'];
      await expect(run()).resolves.toBe(true);
    });

    it('refuses when the role has none of the keys', async () => {
      rolePermIds = ['p-ws'];
      await expect(run()).rejects.toThrow(ForbiddenException);
    });

    it('passes on a per-user grant without the role having it', async () => {
      overrides = [{ permissionId: 'p-view', isGranted: true }];
      await expect(run()).resolves.toBe(true);
    });

    it('does not count a key the user is explicitly denied', async () => {
      rolePermIds = ['p-edit'];
      overrides = [{ permissionId: 'p-edit', isGranted: false }];
      await expect(run()).rejects.toThrow(ForbiddenException);
    });

    it('still passes on another key when one key is denied', async () => {
      rolePermIds = ['p-edit', 'p-view'];
      overrides = [{ permissionId: 'p-edit', isGranted: false }];
      await expect(run()).resolves.toBe(true);
    });

    it('ignores unregistered keys and checks the registered ones', async () => {
      metadata[ANY_PERMISSIONS_KEY] = ['not.registered', 'project.edit'];
      rolePermIds = ['p-edit'];
      await expect(run()).resolves.toBe(true);
    });

    it('refuses when none of the keys is registered (fails closed)', async () => {
      metadata[ANY_PERMISSIONS_KEY] = ['not.registered', 'also.missing'];
      await expect(run()).rejects.toThrow(ForbiddenException);
    });

    it('refuses an unknown active role', async () => {
      rolePermIds = ['p-edit'];
      await expect(run({ id: 'u1', activeRole: 'GHOST' })).rejects.toThrow(ForbiddenException);
    });

    it('needs a logged-in user', async () => {
      await expect(run(null)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('@RequiredPermission (all of) is unchanged', () => {
    it('needs every key', async () => {
      metadata[PERMISSIONS_KEY] = ['project.view-detail', 'project.edit'];
      rolePermIds = ['p-edit'];
      await expect(run()).rejects.toThrow(ForbiddenException);
      rolePermIds = ['p-edit', 'p-view'];
      await expect(run()).resolves.toBe(true);
    });

    it('fails closed on an unregistered key', async () => {
      metadata[PERMISSIONS_KEY] = ['not.registered'];
      await expect(run()).rejects.toThrow(ForbiddenException);
    });

    it('needs both when combined with @RequiredAnyPermission', async () => {
      metadata[ANY_PERMISSIONS_KEY] = ['project.view-detail', 'project.edit'];
      metadata[PERMISSIONS_KEY] = ['project.workspace'];
      rolePermIds = ['p-edit'];
      await expect(run()).rejects.toThrow(ForbiddenException);
      rolePermIds = ['p-edit', 'p-ws'];
      await expect(run()).resolves.toBe(true);
    });
  });
});
