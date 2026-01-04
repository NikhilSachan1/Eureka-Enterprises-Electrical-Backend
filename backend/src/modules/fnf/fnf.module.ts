import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FnfController } from './fnf.controller';
import { FnfService } from './fnf.service';
import { FnfRepository } from './fnf.repository';
import { FnfEntity } from './entities/fnf.entity';
import { FnfDocumentService } from './documents/fnf-document.service';
import { SharedModule } from '../shared/shared.module';
import { UsersModule } from '../users/user.module';
import { PayrollModule } from '../payroll/payroll.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { FilesModule } from '../common/file-upload/files.module';
import { EmailModule } from '../common/email/email.module';
import { ExpenseTrackerModule } from '../expense-tracker/expense-tracker.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FnfEntity]),
    SharedModule,
    UsersModule,
    forwardRef(() => PayrollModule),
    LeaveBalancesModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    FilesModule,
    EmailModule,
    forwardRef(() => ExpenseTrackerModule),
  ],
  controllers: [FnfController],
  providers: [FnfService, FnfRepository, FnfDocumentService],
  exports: [FnfService],
})
export class FnfModule {}
