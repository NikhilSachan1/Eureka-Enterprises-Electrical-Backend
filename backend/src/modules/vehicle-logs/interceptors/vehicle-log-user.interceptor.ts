import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { VEHICLE_LOG_ERRORS } from '../constants/vehicle-logs.constants';

@Injectable()
export class VehicleLogUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // HR and ADMIN can specify vehicleId (create on behalf of others)
    // Other roles can only create logs for their own assigned vehicle
    if (user.role !== Roles.HR && user.role !== Roles.ADMIN) {
      if (request.body.vehicleId) {
        throw new BadRequestException(VEHICLE_LOG_ERRORS.EMPLOYEE_CANNOT_SPECIFY_VEHICLE_ID);
      }
    }

    return next.handle();
  }
}
