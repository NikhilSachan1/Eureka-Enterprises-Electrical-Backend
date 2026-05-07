import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { Environments } from 'env-configs';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserService } from 'src/modules/users/user.service';
import { UserStatus } from 'src/modules/users/constants/user.constants';
import { ACTIVE_ROLE_HEADER, AUTH_ERRORS } from '../constants/auth.constants';
import { JwtPayload, UserFromRequest } from '../auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: Environments.JWT_AUTH_SECRET_KEY,
      });

      const { id, email, roles, activeRole: tokenActiveRole } = payload;

      const user = await this.userService.findOne({ id, email, deletedAt: null });
      if (!user || user.status === UserStatus.ARCHIVED) {
        throw new UnauthorizedException();
      }

      const headerActiveRole = this.extractActiveRoleFromHeader(request);
      const activeRole = headerActiveRole || tokenActiveRole;

      if (!roles || roles.length === 0) {
        throw new ForbiddenException(AUTH_ERRORS.USER_HAS_NO_ROLES);
      }

      if (!roles.includes(activeRole)) {
        throw new ForbiddenException(AUTH_ERRORS.INVALID_ACTIVE_ROLE);
      }

      const userFromRequest: UserFromRequest = {
        id: user.id,
        email: user.email,
        roles,
        activeRole,
        role: activeRole, // Backwards compatibility - existing code uses user.role
      };

      request['user'] = userFromRequest;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (
        error instanceof UnauthorizedException ||
        error instanceof JsonWebTokenError ||
        error instanceof TokenExpiredError ||
        error?.name === 'JsonWebTokenError' ||
        error?.name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException();
      }
      throw new InternalServerErrorException(AUTH_ERRORS.SERVICE_TEMPORARILY_UNAVAILABLE);
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractActiveRoleFromHeader(request: Request): string | undefined {
    const activeRole = request.headers[ACTIVE_ROLE_HEADER];
    return typeof activeRole === 'string' ? activeRole : undefined;
  }
}
