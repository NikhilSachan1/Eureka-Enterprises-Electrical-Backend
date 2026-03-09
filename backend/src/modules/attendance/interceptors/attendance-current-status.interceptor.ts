import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { ATTENDANCE_ERRORS } from '../constants/attendance.constants';

@Injectable()
export class AttendanceCurrentStatusInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const isPrivilegedRole =
      user.activeRole === Roles.SUPER_ADMIN ||
      user.activeRole === Roles.ADMIN ||
      user.activeRole === Roles.HR;

    if (isPrivilegedRole) {
      if (!request.query.userId) {
        request.query.userId = user.id;
      }
    } else {
      if (request.query.userId) {
        throw new BadRequestException(ATTENDANCE_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_IDS);
      }
      request.query.userId = user.id;
    }

    return next.handle();
  }
}
