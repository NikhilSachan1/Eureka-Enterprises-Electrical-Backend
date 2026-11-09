import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Environments } from '../../../env-configs';
import { UserStatus } from '../users/constants/user.constants';
import { AuthService } from './auth.service';
import { AUTH_ERRORS } from './constants/auth.constants';
import { UserFromRequest } from './auth.types';

jest.mock('../users/user.service', () => ({ UserService: class {} }));
jest.mock('../user-roles/user-role.service', () => ({ UserRoleService: class {} }));
jest.mock('../common/email/email.service', () => ({ EmailService: class {} }));
jest.mock('../common/whatsapp/whatsapp.service', () => ({ WhatsAppService: class {} }));
jest.mock('src/utils/utility/utility.service', () => ({ UtilityService: class {} }));
jest.mock('./refresh-token.repository', () => ({ RefreshTokenRepository: class {} }));

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';

const admin: UserFromRequest = {
  id: ADMIN_ID,
  email: 'admin@example.com',
  roles: ['SUPER_ADMIN'],
  activeRole: 'SUPER_ADMIN',
  role: 'SUPER_ADMIN',
};

describe('AuthService impersonation', () => {
  const jwtService = new JwtService({});
  let users: Record<string, any>;
  let roles: Record<string, string[]>;
  let refreshTokens: any;
  let service: AuthService;

  beforeAll(() => {
    (Environments as any).JWT_AUTH_SECRET_KEY = 'access-secret';
    (Environments as any).JWT_REFRESH_SECRET_KEY = 'refresh-secret';
    (Environments as any).JWT_AUTH_TOKEN_EXPIRY = '7d';
  });

  beforeEach(() => {
    users = {
      [ADMIN_ID]: { id: ADMIN_ID, email: admin.email, status: UserStatus.ACTIVE },
      [TARGET_ID]: {
        id: TARGET_ID,
        email: 'target@example.com',
        firstName: 'Test',
        lastName: 'User',
        designation: null,
        status: UserStatus.ACTIVE,
      },
    };
    roles = { [ADMIN_ID]: ['SUPER_ADMIN'], [TARGET_ID]: ['EMPLOYEE'] };
    refreshTokens = {
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };

    service = new AuthService(
      { findOne: jest.fn(async ({ id }) => users[id] ?? null) } as any,
      jwtService,
      {} as any,
      {} as any,
      {
        findAll: jest.fn(async ({ where: { userId } }) =>
          (roles[userId] ?? []).map((name) => ({ role: { name } })),
        ),
      } as any,
      refreshTokens,
      {} as any,
    );
  });

  const expectForbidden = async (promise: Promise<unknown>, message: string) => {
    await expect(promise).rejects.toThrow(new ForbiddenException(message));
    expect(refreshTokens.create).not.toHaveBeenCalled();
  };

  it('issues short-lived tokens that record the admin', async () => {
    const result = await service.impersonate(admin, TARGET_ID);

    const access = jwtService.decode(result.accessToken);
    expect(access).toMatchObject({ id: TARGET_ID, impersonatedBy: ADMIN_ID });
    expect(access.exp - access.iat).toBe(15 * 60);

    const refresh = jwtService.decode(result.refreshToken);
    expect(refresh).toMatchObject({ userId: TARGET_ID, impersonatedBy: ADMIN_ID });
    expect(refresh.exp - refresh.iat).toBeLessThanOrEqual(60 * 60);
  });

  it('rejects a user whose active role is not SUPER_ADMIN', () =>
    expectForbidden(
      service.impersonate({ ...admin, activeRole: 'ADMIN', role: 'ADMIN' }, TARGET_ID),
      AUTH_ERRORS.IMPERSONATION_NOT_ALLOWED,
    ));

  it('rejects a token claiming SUPER_ADMIN after the role was removed', () => {
    roles[ADMIN_ID] = ['ADMIN'];
    return expectForbidden(
      service.impersonate(admin, TARGET_ID),
      AUTH_ERRORS.IMPERSONATION_NOT_ALLOWED,
    );
  });

  it('rejects starting from an impersonation session', () =>
    expectForbidden(
      service.impersonate({ ...admin, impersonatedBy: TARGET_ID }, TARGET_ID),
      AUTH_ERRORS.IMPERSONATION_ALREADY_ACTIVE,
    ));

  it('rejects targeting yourself', () =>
    expectForbidden(service.impersonate(admin, ADMIN_ID), AUTH_ERRORS.IMPERSONATION_TARGET_SELF));

  it('rejects targeting another super admin, even one with extra roles', () => {
    roles[TARGET_ID] = ['EMPLOYEE', 'super_admin'];
    return expectForbidden(
      service.impersonate(admin, TARGET_ID),
      AUTH_ERRORS.IMPERSONATION_TARGET_SUPER_ADMIN,
    );
  });

  it('rejects an archived target', () => {
    users[TARGET_ID].status = UserStatus.ARCHIVED;
    return expectForbidden(service.impersonate(admin, TARGET_ID), AUTH_ERRORS.USER_ARCHIVED);
  });

  describe('refresh', () => {
    const startSession = async () => {
      const { refreshToken } = await service.impersonate(admin, TARGET_ID);
      const expiresAt = refreshTokens.create.mock.calls[0][0].expiresAt;
      refreshTokens.findOne.mockResolvedValue({ expiresAt });
      return { refreshToken, expiresAt };
    };

    it('keeps the admin on the new tokens and does not extend the session', async () => {
      const { refreshToken, expiresAt } = await startSession();

      const result = await service.refreshAccessToken({ refreshToken });

      expect(jwtService.decode(result.accessToken)).toMatchObject({ impersonatedBy: ADMIN_ID });
      expect(jwtService.decode(result.refreshToken)).toMatchObject({ impersonatedBy: ADMIN_ID });
      expect(refreshTokens.create.mock.calls[1][0].expiresAt).toBe(expiresAt);
    });

    it('ends the session once the admin loses SUPER_ADMIN', async () => {
      const { refreshToken } = await startSession();
      roles[ADMIN_ID] = ['ADMIN'];

      await expect(service.refreshAccessToken({ refreshToken })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokens.update).toHaveBeenCalledWith(
        { token: refreshToken },
        { isRevoked: true },
      );
    });
  });

  it('keeps the admin and short expiry when switching role', async () => {
    roles[TARGET_ID] = ['EMPLOYEE', 'HR'];

    const result = await service.switchRole(
      {
        id: TARGET_ID,
        email: 'target@example.com',
        roles: roles[TARGET_ID],
        activeRole: 'EMPLOYEE',
        role: 'EMPLOYEE',
        impersonatedBy: ADMIN_ID,
      },
      { targetRole: 'HR' } as any,
    );

    const access = jwtService.decode(result.accessToken);
    expect(access).toMatchObject({ activeRole: 'HR', impersonatedBy: ADMIN_ID });
    expect(access.exp - access.iat).toBe(15 * 60);
  });

  it('leaves normal sign-in tokens unchanged by the short expiry', async () => {
    const token = (service as any).generateAccessToken({
      id: ADMIN_ID,
      email: admin.email,
      roles: admin.roles,
      activeRole: admin.activeRole,
    });

    const decoded = jwtService.decode(token);
    expect(decoded.impersonatedBy).toBeUndefined();
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });
});
