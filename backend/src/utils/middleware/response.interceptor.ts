import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isNull } from 'lodash';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((response) => {
        if (response === null || response === undefined) {
          return { status: 404 };
        }

        if (Array.isArray(response)) {
          return response;
        }

        if (typeof response === 'object' && !Array.isArray(response)) {
          const responseValues = Object.values(response);
          const isEmpty = responseValues.every(isNull);

          return isEmpty ? { ...response, status: 404 } : response;
        }

        return response;
      }),
    );
  }
}
