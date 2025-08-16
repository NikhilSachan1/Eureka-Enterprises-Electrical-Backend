import { Module } from '@nestjs/common';
import { ExpenseTrackerService } from './expense-tracker.service';
import { ExpenseTrackerController } from './expense-tracker.controller';
import { ExpenseTrackerRepository } from './expense-tracker.repository';
import { ExpenseTrackerEntity } from './entities/expense-tracker.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ExpenseFilesModule } from '../expense-files/expense-files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseTrackerEntity]),
    SharedModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    ExpenseFilesModule,
  ],
  controllers: [ExpenseTrackerController],
  providers: [ExpenseTrackerService, ExpenseTrackerRepository],
  exports: [ExpenseTrackerService],
})
export class ExpenseTrackerModule {}
