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
export class AttendanceHistoryUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === Roles.ADMIN || user.role === Roles.MANAGER || user.role === Roles.HR) {
      if (!request.query.userId) {
        throw new BadRequestException(ATTENDANCE_ERRORS.USER_ID_REQUIRED);
      }
    }

    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      if (request.query.userId) {
        throw new BadRequestException(ATTENDANCE_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_IDS);
      }

      request.query.userId = user.id;
    }

    return next.handle();
  }
}
