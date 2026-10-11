import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MyDashboardController } from './my-dashboard.controller';
import { MyDashboardService } from './my-dashboard.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [DashboardController, MyDashboardController],
  providers: [DashboardService, MyDashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
