import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from 'src/modules/roles/constants/role.constants';
import { SALARY_STRUCTURE_ERRORS } from '../constants/salary-structure.constants';

@Injectable()
export class SalaryStructureUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === Roles.EMPLOYEE || user.role === Roles.DRIVER) {
      if (request.query.userId) {
        throw new BadRequestException(SALARY_STRUCTURE_ERRORS.EMPLOYEE_CANNOT_SPECIFY_USER_ID);
      }

      request.query.userId = user.id;
    }

    return next.handle();
  }
}
