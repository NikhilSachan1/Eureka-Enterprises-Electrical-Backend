import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * TimezoneInterceptor - Extracts and validates timezone for each request
 *
 * Priority Order:
 * 1. X-Timezone header (request-level override)
 * 2. User's profile timezone (from JWT/user entity)
 * 3. Default timezone (Asia/Kolkata - IST)
 */
@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  private readonly DEFAULT_TIMEZONE = 'Asia/Kolkata';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    const headerTimezone = request.headers['x-timezone'];

    const userTimezone = request.user?.timezone;

    let resolvedTimezone = headerTimezone || userTimezone || this.DEFAULT_TIMEZONE;

    if (!this.isValidTimezone(resolvedTimezone)) {
      resolvedTimezone = this.DEFAULT_TIMEZONE;
    }

    request.timezone = resolvedTimezone;

    return next.handle();
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
