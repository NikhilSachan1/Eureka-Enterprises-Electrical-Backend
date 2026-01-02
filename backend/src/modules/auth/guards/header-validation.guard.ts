import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Environments } from 'env-configs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  ACTIVE_ROLE_HEADER,
  CORRELATION_ID_HEADER,
  SOURCE_TYPE_HEADER,
  CLIENT_TYPE_HEADER,
  HEADER_ERRORS,
} from '../constants/auth.constants';

@Injectable()
export class HeaderValidationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (!Environments.ENFORCE_REQUIRED_HEADERS) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const missingHeaders: string[] = [];

    if (!this.hasHeader(request, ACTIVE_ROLE_HEADER)) {
      missingHeaders.push('X-Active-Role');
    }

    if (!this.hasHeader(request, CORRELATION_ID_HEADER)) {
      missingHeaders.push('X-Correlation-Id');
    }

    if (!this.hasHeader(request, SOURCE_TYPE_HEADER)) {
      missingHeaders.push('X-Source-Type');
    }

    if (!this.hasHeader(request, CLIENT_TYPE_HEADER)) {
      missingHeaders.push('X-Client-Type');
    }

    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        HEADER_ERRORS.MISSING_REQUIRED_HEADERS.replace('{headers}', missingHeaders.join(', ')),
      );
    }

    return true;
  }

  private hasHeader(request: Request, headerName: string): boolean {
    const value = request.headers[headerName];
    return typeof value === 'string' && value.trim().length > 0;
  }
}
