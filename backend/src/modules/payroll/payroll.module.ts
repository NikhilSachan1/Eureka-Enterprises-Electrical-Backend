import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollEntity } from './entities/payroll.entity';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { PayslipService } from './payslip/payslip.service';
import { SalaryStructureModule } from '../salary-structures/salary-structure.module';
import { BonusModule } from '../bonuses/bonus.module';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';
import { EmailModule } from '../common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollEntity]),
    SharedModule,
    SalaryStructureModule,
    BonusModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    LeaveBalancesModule,
    EmailModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollRepository, PayslipService],
  exports: [PayrollService, PayrollRepository, PayslipService],
})
export class PayrollModule {}
