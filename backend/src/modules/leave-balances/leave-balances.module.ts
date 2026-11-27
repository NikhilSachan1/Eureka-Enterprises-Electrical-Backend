import { Module } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesRepository } from './leave-balances.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveLedgerEntryEntity } from './entities/leave-ledger-entry.entity';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { LeaveLedgerService } from './leave-ledger.service';
import { LeaveAccrualService } from './leave-accrual.service';
import { LeaveLedgerController } from './leave-ledger.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalanceEntity, LeaveLedgerEntryEntity]),
    SharedModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [LeaveBalancesController, LeaveLedgerController],
  providers: [
    LeaveBalancesService,
    LeaveBalancesRepository,
    LeaveLedgerService,
    LeaveAccrualService,
  ],
  exports: [LeaveBalancesService, LeaveLedgerService, LeaveAccrualService],
})
export class LeaveBalancesModule {}
