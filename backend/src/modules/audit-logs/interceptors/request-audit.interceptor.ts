import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogService } from '../audit-log.service';
import { EXCLUDED_ENDPOINTS } from '../constants/audit-log.constants';
import { getClientIp } from '../utils/sensitive-data-mask.util';
import { auditContextStorage, AuditContext } from '../context/audit.context';

@Injectable()
export class RequestAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestAuditInterceptor.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const url = request.url;

    // Skip excluded endpoints
    if (EXCLUDED_ENDPOINTS.some((excluded) => url.includes(excluded))) {
      return next.handle();
    }

    const correlationId = request.headers['x-correlation-id'] || uuidv4();
    const startTime = Date.now();

    // Set correlation ID in response header
    response.setHeader('x-correlation-id', correlationId);

    // Extract user from request (set by AuthGuard)
    const userId = request.user?.id;
    const userIp = getClientIp(request);
    const userAgent = request.headers['user-agent'];

    // Create audit context for entity subscriber
    const auditContext: AuditContext = {
      correlationId,
      userId,
      userIp,
    };

    // Clone request body to avoid issues with stream consumption
    const requestBody = this.sanitizeRequestBody(request.body);
    const queryParams = request.query;

    return auditContextStorage.run(auditContext, () => {
      return next.handle().pipe(
        tap(async (responseBody) => {
          const responseTimeMs = Date.now() - startTime;

          // Log asynchronously to not block response
          setImmediate(async () => {
            try {
              await this.auditLogService.createRequestLog({
                correlationId,
                method: request.method,
                url: url,
                queryParams,
                requestBody,
                requestHeaders: request.headers,
                responseStatus: response.statusCode,
                responseBody,
                responseTimeMs,
                userId,
                userIp,
                userAgent,
              });
            } catch (error) {
              this.logger.error(`Failed to log request audit: ${error.message}`);
            }
          });
        }),
        catchError(async (error) => {
          const responseTimeMs = Date.now() - startTime;

          // Log error asynchronously
          setImmediate(async () => {
            try {
              await this.auditLogService.createRequestLog({
                correlationId,
                method: request.method,
                url: url,
                queryParams,
                requestBody,
                requestHeaders: request.headers,
                responseStatus: error.status || 500,
                responseBody: {
                  error: error.response || error.message,
                },
                responseTimeMs,
                errorMessage: error.message,
                errorStack: error.stack,
                userId,
                userIp,
                userAgent,
              });
            } catch (logError) {
              this.logger.error(`Failed to log error audit: ${logError.message}`);
            }
          });

          throw error;
        }),
      );
    });
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return null;

    if (typeof body === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(body)) {
        if (value && typeof value === 'object' && 'buffer' in value) {
          sanitized[key] = {
            _type: 'file',
            _filename: (value as any).originalname,
            _mimetype: (value as any).mimetype,
            _size: (value as any).size,
          };
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return body;
  }
}
