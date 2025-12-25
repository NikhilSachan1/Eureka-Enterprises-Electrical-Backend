import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollEntity } from './entities/payroll.entity';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { SalaryStructureModule } from '../salary-structures/salary-structure.module';
import { BonusModule } from '../bonuses/bonus.module';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollEntity]),
    SharedModule,
    SalaryStructureModule,
    BonusModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollRepository],
  exports: [PayrollService, PayrollRepository],
})
export class PayrollModule {}
