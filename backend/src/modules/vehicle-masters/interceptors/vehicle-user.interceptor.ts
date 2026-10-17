import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { PermissionsGuard } from 'src/modules/auth/guards/permissions.guard';
import { UserFromRequest } from 'src/modules/auth/auth.types';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { VEHICLE_MASTERS_ERRORS } from '../constants/vehicle-masters.constants';

/**
 * On-behalf-of lookups (manual fuel, manual vehicle reading) need another
 * employee's assigned vehicle. Add-fuel omits userId and still resolves to self.
 */
const ASSIGNED_VEHICLE_LOOKUP_PERMISSIONS = ['fuel.force', 'vehicle-reading.force'];

@Injectable()
export class VehicleUserInterceptor implements NestInterceptor {
  constructor(private readonly permissionsGuard: PermissionsGuard) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return from(this.applyUserScope(context)).pipe(switchMap(() => next.handle()));
  }

  private async applyUserScope(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserFromRequest;
    const requestedUserId = request.query.userId as string | undefined;

    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      const isAnotherUser = !!requestedUserId && requestedUserId !== user.id;
      if (isAnotherUser) {
        const canLookupSelectedEmployee = await this.permissionsGuard.hasAnyPermission(
          user,
          ASSIGNED_VEHICLE_LOOKUP_PERMISSIONS,
        );
        if (!canLookupSelectedEmployee) {
          throw new BadRequestException(VEHICLE_MASTERS_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_ID);
        }
      }

      if (!requestedUserId) {
        request.query.userId = user.id;
      }
      return;
    }

    if (!requestedUserId) {
      request.query.userId = user.id;
    }
  }
}
