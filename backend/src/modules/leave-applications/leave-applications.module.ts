import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveApplicationsEntity]),
    SharedModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    LeaveBalancesModule,
    UsersModule,
  ],
  controllers: [LeaveApplicationsController],
  providers: [LeaveApplicationsService, LeaveApplicationsRepository],
})
export class LeaveApplicationsModule {}
