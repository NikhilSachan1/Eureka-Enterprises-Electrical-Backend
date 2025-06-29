import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  @Cron('*/10 * * * *')
  async handleCronJob() {
    this.logger.log('Cron job started - Running every 10 minutes');

    return {
      sucess: true,
    };
  }
}
