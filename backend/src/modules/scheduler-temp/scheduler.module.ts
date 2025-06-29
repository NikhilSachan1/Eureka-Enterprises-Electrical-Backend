import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [SchedulerService],
})
export class SchedulerModule {}
