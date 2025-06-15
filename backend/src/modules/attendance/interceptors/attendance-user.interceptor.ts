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
export class AttendanceUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === Roles.EMPLOYEE) {
      if (request.query.userIds) {
        throw new BadRequestException(ATTENDANCE_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_IDS);
      }

      request.query.userIds = [user.id];
    }

    return next.handle();
  }
}
