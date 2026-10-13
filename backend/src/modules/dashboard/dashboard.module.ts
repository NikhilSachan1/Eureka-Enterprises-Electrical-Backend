import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { WorkBoardService } from './work-board.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [DashboardController],
  providers: [DashboardService, WorkBoardService],
  exports: [DashboardService],
})
export class DashboardModule {}
