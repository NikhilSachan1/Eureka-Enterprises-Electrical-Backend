import { Module } from '@nestjs/common';
import { CronTriggerController } from './cron-trigger.controller';
import { CronTriggerService } from './cron-trigger.service';
import { CronLogModule } from '../cron-logs/cron-log.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [CronLogModule, SchedulerModule],
  controllers: [CronTriggerController],
  providers: [CronTriggerService],
  exports: [CronTriggerService],
})
export class CronTriggerModule {}
