import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context: HttpArgumentsHost = host.switchToHttp();
    const req = context.getRequest();
    const res = context.getResponse();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();
    const errorResponse = {
      error: {
        code: status,
        timestamp: new Date().toLocaleDateString(),
        path: req.url,
        method: req.method,
        message:
          (exceptionResponse &&
            exceptionResponse.response &&
            exceptionResponse.response.errorMessage) ||
          exceptionResponse.message ||
          exception.message,
      },
    };
    Logger.error(`${req.method} ${req.url}`, JSON.stringify(errorResponse), 'ExceptionFilter');
    res.status(status).json(errorResponse);
  }
}
