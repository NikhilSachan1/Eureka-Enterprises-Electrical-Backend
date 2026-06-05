import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { USER_PERMISSION_ERRORS } from '../constants/user-permission.constants';
import { PermissionPlatform } from 'src/modules/permissions/constants/permission.constants';

@Injectable()
export class UserPermissionUserIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const isSuperAdmin = user.role === Roles.SUPER_ADMIN;

    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      if (request.query.userId || request.query.permissionId || request.query.isActive) {
        throw new BadRequestException(USER_PERMISSION_ERRORS.CANNOT_SPECIFY_FIELDS);
      }
      request.query.userId = user.id;
    } else if (isSuperAdmin) {
      if (!request.query.userId) {
        request.query.userId = user.id;
      }
    } else {
      // All other roles (ADMIN, HR, MANAGER, OPERATION_MANAGER, etc.) - use their own userId only
      if (!request.query.userId) {
        request.query.userId = user.id;
      }
    }

    // Auto-detect platform from headers if not explicitly provided
    if (!request.query.platform) {
      const detectedPlatform = this.detectPlatform(request);
      if (detectedPlatform) {
        request.query.platform = detectedPlatform;
      }
    }

    return next.handle();
  }

  private detectPlatform(request: any): PermissionPlatform | null {
    // Check x-client-type header first (preferred method)
    const clientType = request.headers['x-client-type']?.toLowerCase();
    if (clientType === 'mobile') {
      return PermissionPlatform.MOBILE;
    }
    if (clientType === 'web') {
      return PermissionPlatform.WEB;
    }

    // Check x-platform header as alternative
    const platformHeader = request.headers['x-platform']?.toLowerCase();
    if (platformHeader === 'mobile') {
      return PermissionPlatform.MOBILE;
    }
    if (platformHeader === 'web') {
      return PermissionPlatform.WEB;
    }

    // Fallback: detect from user-agent
    const userAgent = request.headers['user-agent']?.toLowerCase() || '';
    const mobileIndicators = ['android', 'iphone', 'ipad', 'mobile', 'dart', 'flutter', 'okhttp'];

    if (mobileIndicators.some((indicator) => userAgent.includes(indicator))) {
      return PermissionPlatform.MOBILE;
    }

    // Default to web if user-agent looks like a browser
    const browserIndicators = ['mozilla', 'chrome', 'safari', 'firefox', 'edge', 'opera'];
    if (browserIndicators.some((indicator) => userAgent.includes(indicator))) {
      return PermissionPlatform.WEB;
    }

    // If cannot detect, return null (will return all permissions)
    return null;
  }
}
