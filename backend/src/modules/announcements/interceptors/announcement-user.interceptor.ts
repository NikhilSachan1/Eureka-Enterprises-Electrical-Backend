import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';

@Injectable()
export class AnnouncementUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Admin and HR can see all announcements
    // Other roles only see announcements targeted to them
    const isPrivilegedRole = user.role === Roles.ADMIN || user.role === Roles.HR;

    if (!isPrivilegedRole) {
      request.query.userId = user.id;
      request.query.roleIds = Array.isArray(user.role) ? user.role : [user.role];
    }

    return next.handle();
  }
}
