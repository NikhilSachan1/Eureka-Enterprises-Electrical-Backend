import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { LEAVE_APPLICATION_ERRORS } from '../constants/leave-application.constants';

@Injectable()
export class LeaveUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      if (request.query.userIds) {
        throw new BadRequestException(LEAVE_APPLICATION_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_IDS);
      }

      request.query.userIds = [user.id];
    }

    return next.handle();
  }
}
