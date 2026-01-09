import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronLogEntity } from './entities/cron-log.entity';
import { CronLogRepository } from './cron-log.repository';
import { CronLogService } from './cron-log.service';
import { CronLogController } from './cron-log.controller';
import { SharedModule } from '../shared/shared.module';
import { EmailModule } from '../common/email/email.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CronLogEntity]),
    SharedModule,
    EmailModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [CronLogController],
  providers: [CronLogService, CronLogRepository],
  exports: [CronLogService],
})
export class CronLogModule {}
