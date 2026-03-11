import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';

@Injectable()
export class DsrUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SUPER_ADMIN, HR and ADMIN can filter by any userId
    // Other roles can only see their own DSRs
    const allowedRoles = [Roles.SUPER_ADMIN, Roles.HR, Roles.ADMIN, Roles.MANAGER];
    if (!allowedRoles.includes(user.role)) {
      if (request.query.userId && request.query.userId !== user.id) {
        throw new BadRequestException('You can only view your own Daily Status Reports');
      }

      // Force userId to be the logged-in user's ID
      request.query.userId = user.id;
    }

    return next.handle();
  }
}
