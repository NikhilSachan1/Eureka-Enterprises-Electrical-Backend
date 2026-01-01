import { Module } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesRepository } from './leave-balances.repository';
import { LeaveCreditService } from './leave-credit.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalanceEntity]),
    SharedModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [LeaveBalancesController],
  providers: [LeaveBalancesService, LeaveBalancesRepository, LeaveCreditService],
  exports: [LeaveBalancesService, LeaveCreditService],
})
export class LeaveBalancesModule {}
