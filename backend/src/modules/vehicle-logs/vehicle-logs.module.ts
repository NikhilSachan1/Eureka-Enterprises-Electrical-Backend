import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleLogsController } from './vehicle-logs.controller';
import { VehicleLogsService } from './vehicle-logs.service';
import { VehicleLogsRepository } from './vehicle-logs.repository';
import { VehicleLogEntity } from './entities/vehicle-log.entity';
import { VehicleLogFileEntity } from './entities/vehicle-log-file.entity';
import { VehicleVersionsModule } from '../vehicle-versions/vehicle-versions.module';
import { SiteAllocationModule } from '../site-allocations/site-allocation.module';
import { SiteModule } from '../sites/site.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleLogEntity, VehicleLogFileEntity]),
    VehicleVersionsModule,
    SiteAllocationModule,
    SiteModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    SharedModule,
  ],
  controllers: [VehicleLogsController],
  providers: [VehicleLogsService, VehicleLogsRepository],
  exports: [VehicleLogsService, VehicleLogsRepository],
})
export class VehicleLogsModule {}
