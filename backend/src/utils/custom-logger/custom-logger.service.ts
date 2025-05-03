import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
import { RequestContext } from './request-context';

@Injectable({ scope: Scope.REQUEST })
export class CustomLoggerService extends ConsoleLogger {
  constructor(private req?: RequestContext, context?: string) {
    super(context);
  }

  public log(message: unknown, context?: string): void {
    super.log(message, this.prefixContext(context));
  }

  public error(message: unknown, trace?: string, context?: string): void {
    super.error(message, trace, this.prefixContext(context));
  }

  private get reqContext(): string {
    return this.req && this.req.context ? this.req.context.id : '';
  }

  private getContext(context?: string): string {
    return context || this.context || '';
  }

  private prefixContext(context?: string): string {
    const prefix = [];

    this.reqContext && prefix.push(this.reqContext);

    const ctx = this.getContext(context);
    ctx && prefix.push(ctx);

    return prefix.join('] [');
  }
}
