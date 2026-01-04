import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { SALARY_STRUCTURE_ERRORS } from '../constants/salary-structure.constants';

@Injectable()
export class SalaryStructureParamUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      const paramUserId = request.params.userId;
      if (paramUserId && paramUserId !== user.id) {
        throw new ForbiddenException(SALARY_STRUCTURE_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_ID);
      }
    }

    return next.handle();
  }
}
