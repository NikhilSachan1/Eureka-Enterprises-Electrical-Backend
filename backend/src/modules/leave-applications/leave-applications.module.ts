import { Module, forwardRef } from '@nestjs/common';
import { LeaveApplicationsService } from './leave-applications.service';
import { LeaveApplicationsController } from './leave-applications.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveApplicationsEntity } from './entities/leave-application.entity';
import { SharedModule } from '../shared/shared.module';
import { LeaveApplicationsRepository } from './leave-applications.repository';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';
import { UsersModule } from '../users/user.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmailModule } from '../common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveApplicationsEntity]),
    SharedModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    LeaveBalancesModule,
    UsersModule,
    forwardRef(() => AttendanceModule),
    EmailModule,
  ],
  controllers: [LeaveApplicationsController],
  providers: [LeaveApplicationsService, LeaveApplicationsRepository],
  exports: [LeaveApplicationsService],
})
export class LeaveApplicationsModule {}
