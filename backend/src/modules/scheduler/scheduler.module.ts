import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AttendanceCronService } from './crons/attendance.cron.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { UsersModule } from '../users/user.module';
import { LeaveApplicationsModule } from '../leave-applications/leave-applications.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SharedModule,
    AttendanceModule,
    UsersModule,
    LeaveApplicationsModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  providers: [SchedulerService, AttendanceCronService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
