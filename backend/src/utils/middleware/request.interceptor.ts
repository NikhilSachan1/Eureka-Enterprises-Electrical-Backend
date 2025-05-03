import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RequestInterceptor<T> implements NestInterceptor<T> {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<T>> {
    return next.handle();
  }
}
