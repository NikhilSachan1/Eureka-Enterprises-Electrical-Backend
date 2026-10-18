import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { ManagedUsersService } from 'src/modules/user-delegations/managed-users.service';
import {
  DELEGATABLE_MODULES,
  USER_DELEGATION_ERRORS,
} from 'src/modules/user-delegations/constants/user-delegation.constants';

/**
 * Whose assigned vehicle (and petro card) may the caller look up.
 *
 * The add-fuel screen calls this for whoever the fuel is being filed for, so it answers with
 * exactly the same set the fuel module does — `ManagedUsersService` for `fuel`. Anything else and
 * the two could disagree: a manager allowed to file B's fuel but refused B's vehicle, or the
 * reverse.
 *
 * Behaviour:
 *   no `userId`                → the caller's own vehicle
 *   `userId` is the caller     → allowed (it used to be a flat 400 for EMPLOYEE/DRIVER even here)
 *   `userId` someone they manage for fuel → allowed
 *   anyone else                → 403
 *
 * Office roles resolve to "no restriction" and keep reaching anybody, as before.
 */
@Injectable()
export class VehicleUserInterceptor implements NestInterceptor {
  constructor(private readonly managedUsers: ManagedUsersService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const asked = request.query.userId as string | undefined;

    if (!asked || asked === user.id) {
      request.query.userId = user.id;
      return next.handle();
    }

    return from(
      this.managedUsers.resolveManagedUserIds(
        user.id,
        user.activeRole ?? user.role,
        DELEGATABLE_MODULES.FUEL,
      ),
    ).pipe(
      switchMap((allowed) => {
        if (allowed !== null && !allowed.includes(asked)) {
          throw new ForbiddenException(
            USER_DELEGATION_ERRORS.NOT_ALLOWED_FOR_USER.replace(
              '{module}',
              DELEGATABLE_MODULES.FUEL,
            ),
          );
        }
        return next.handle();
      }),
    );
  }
}
