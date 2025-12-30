import { Injectable, Logger } from '@nestjs/common';
import { DateTimeService } from 'src/utils/datetime';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly ORG_TIMEZONE = 'Asia/Kolkata'; // Organization timezone

  constructor(private readonly dateTimeService: DateTimeService) {}

  getCurrentDateIST(): Date {
    return this.dateTimeService.getNowInTimezone(this.ORG_TIMEZONE);
  }

  getTodayDateIST(): Date {
    return this.dateTimeService.getStartOfToday(this.ORG_TIMEZONE);
  }

  getTodayStringIST(): string {
    return this.dateTimeService.getTodayString(this.ORG_TIMEZONE);
  }

  getOrgTimezone(): string {
    return this.ORG_TIMEZONE;
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
