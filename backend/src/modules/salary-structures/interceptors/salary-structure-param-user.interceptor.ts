import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';

@Injectable()
export class SalaryStructureParamUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // For Employee and Driver roles, automatically set userId to their own ID
    // They can only view their own salary structure
    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      request.params.userId = user.id;
    }

    return next.handle();
  }
}
