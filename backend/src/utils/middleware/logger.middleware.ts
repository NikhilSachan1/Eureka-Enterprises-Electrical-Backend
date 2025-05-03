import { CustomLoggerService } from '../custom-logger/custom-logger.service';
import { CustomRequest } from '../custom-logger/interface/request.interface';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: CustomLoggerService) {}

  public async use(req: CustomRequest, res: Response, next: () => void): Promise<void> {
    const { nanoid } = await import('nanoid');
    req.id = req.header('x-Request-Id') || nanoid();
    res.setHeader('x-Request-Id', req.id);
    this.logger.log(`${req.method} ${req.originalUrl}`);
    return next();
  }
}
