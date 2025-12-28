import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  getCurrentDateIST(): Date {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset);
  }

  getTodayDateIST(): Date {
    const istDate = this.getCurrentDateIST();
    return new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate());
  }

  logCronStart(cronName: string): void {
    this.logger.log(`[${cronName}] Started at ${new Date().toISOString()}`);
  }

  logCronComplete(cronName: string, result: any): void {
    this.logger.log(`[${cronName}] Completed at ${new Date().toISOString()}`, result);
  }

  logCronError(cronName: string, error: Error): void {
    this.logger.error(`[${cronName}] Error at ${new Date().toISOString()}`, error.stack);
  }
}
