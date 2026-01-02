import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserFromRequest } from '../auth.types';
import { AUTH_ERRORS } from '../constants/auth.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserFromRequest = request.user;

    if (!user) {
      throw new ForbiddenException(AUTH_ERRORS.USER_NOT_AUTHENTICATED);
    }

    const hasRole = requiredRoles.includes(user.activeRole);

    if (!hasRole) {
      throw new ForbiddenException(
        AUTH_ERRORS.ACCESS_DENIED_REQUIRED_ROLES.replace(
          '{requiredRoles}',
          requiredRoles.join(', '),
        ).replace('{activeRole}', user.activeRole),
      );
    }

    return true;
  }
}
