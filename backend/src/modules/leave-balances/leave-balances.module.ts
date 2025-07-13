import { Module } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesRepository } from './leave-balances.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveBalanceEntity]), SharedModule],
  controllers: [LeaveBalancesController],
  providers: [LeaveBalancesService, LeaveBalancesRepository],
})
export class LeaveBalancesModule {}
