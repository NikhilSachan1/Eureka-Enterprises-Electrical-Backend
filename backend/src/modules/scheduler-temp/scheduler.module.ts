import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [],
  controllers: [],
  providers: [SchedulerService],
})
export class SchedulerModule {}
