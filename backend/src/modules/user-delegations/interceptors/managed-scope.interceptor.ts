import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { ManagedUsersService } from '../managed-users.service';
import { DelegatableModule, USER_DELEGATION_ERRORS } from '../constants/user-delegation.constants';

/**
 * Narrow a list request to the rows the caller may see.
 *
 * Replaces the hardcoded rule this used to carry — *role is EMPLOYEE or DRIVER, therefore only
 * your own* — which lived in two separate copies, one in expense and one in fuel. Both now ask
 * `ManagedUsersService`, so they cannot answer differently.
 *
 * Behaviour:
 *   no restriction     → the request is left exactly as it came
 *   `userIds` absent   → filled with everyone the caller may see
 *   `userIds` present  → each one must be in that set, otherwise 403
 *
 * The last case used to be a flat 400 for any employee who passed `userIds` at all. It is now
 * only refused when they ask for somebody who is not theirs, and as 403 rather than 400 — the
 * request is well-formed, it is the caller who is not allowed.
 */
@Injectable()
export class ManagedScopeInterceptor implements NestInterceptor {
  constructor(
    private readonly managedUsers: ManagedUsersService,
    private readonly module: DelegatableModule,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return from(
      this.managedUsers.resolveManagedUserIds(user.id, user.activeRole ?? user.role, this.module),
    ).pipe(
      switchMap((allowed) => {
        if (allowed === null) return next.handle();

        const asked = request.query.userIds;
        if (!asked) {
          request.query.userIds = allowed;
          return next.handle();
        }

        const list = Array.isArray(asked) ? asked : [asked];
        const outside = list.filter((id: string) => !allowed.includes(id));
        if (outside.length) {
          throw new ForbiddenException(
            USER_DELEGATION_ERRORS.NOT_ALLOWED_FOR_USER.replace('{module}', this.module),
          );
        }
        return next.handle();
      }),
    );
  }
}

/**
 * The two concrete interceptors.
 *
 * Subclasses rather than a factory so Nest can inject them by class at the route, which is how
 * the ones they replace were wired.
 */
@Injectable()
export class ExpenseManagedScopeInterceptor extends ManagedScopeInterceptor {
  constructor(managedUsers: ManagedUsersService) {
    super(managedUsers, 'expense');
  }
}

@Injectable()
export class FuelManagedScopeInterceptor extends ManagedScopeInterceptor {
  constructor(managedUsers: ManagedUsersService) {
    super(managedUsers, 'fuel');
  }
}
