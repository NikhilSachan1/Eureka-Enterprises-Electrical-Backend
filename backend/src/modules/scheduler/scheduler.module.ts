import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AttendanceCronService } from './crons/attendance.cron.service';
import { LeaveCronService } from './crons/leave.cron.service';
import { PayrollCronService } from './crons/payroll.cron.service';
import { AnnouncementCronService } from './crons/announcement.cron.service';
import { VehicleCronService } from './crons/vehicle.cron.service';
import { AssetCronService } from './crons/asset.cron.service';
import { CardCronService } from './crons/card.cron.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { UsersModule } from '../users/user.module';
import { LeaveApplicationsModule } from '../leave-applications/leave-applications.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { PayrollModule } from '../payroll/payroll.module';
import { EmailModule } from '../common/email/email.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SharedModule,
    AttendanceModule,
    UsersModule,
    LeaveApplicationsModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    PayrollModule,
    EmailModule,
  ],
  providers: [
    SchedulerService,
    AttendanceCronService,
    LeaveCronService,
    PayrollCronService,
    AnnouncementCronService,
    VehicleCronService,
    AssetCronService,
    CardCronService,
  ],
  exports: [SchedulerService],
})
export class SchedulerModule {}
