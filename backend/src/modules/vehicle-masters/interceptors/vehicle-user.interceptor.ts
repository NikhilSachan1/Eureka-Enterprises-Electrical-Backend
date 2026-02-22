import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { VEHICLE_MASTERS_ERRORS } from '../constants/vehicle-masters.constants';

@Injectable()
export class VehicleUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // For EMPLOYEE or DRIVER roles, use their own user ID
    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      if (request.query.userId) {
        throw new BadRequestException(VEHICLE_MASTERS_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_ID);
      }

      request.query.userId = user.id;
    }

    return next.handle();
  }
}
