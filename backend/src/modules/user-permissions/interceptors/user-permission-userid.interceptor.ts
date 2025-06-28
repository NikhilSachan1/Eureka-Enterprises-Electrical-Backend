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

@Injectable()
export class UserPermissionUserIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      if (request.query.userId || request.query.permissionId || request.query.isGranted) {
        throw new BadRequestException(USER_PERMISSION_ERRORS.CANNOT_SPECIFY_FIELDS);
      }
      request.query.userId = [user.id];
    }

    return next.handle();
  }
}
