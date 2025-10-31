import { Module } from '@nestjs/common';
import { AssetMastersService } from './asset-masters.service';
import { AssetMastersController } from './asset-masters.controller';
import { AssetMastersRepository } from './asset-masters.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetMasterEntity } from './entities/asset-master.entity';
import { AssetFilesModule } from '../asset-files/asset-files.module';
import { AssetEventsModule } from '../asset-events/asset-events.module';
import { AssetVersionsModule } from '../asset-versions/asset-versions.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetMasterEntity]),
    AssetFilesModule,
    AssetEventsModule,
    AssetVersionsModule,
    SharedModule,
  ],
  controllers: [AssetMastersController],
  providers: [AssetMastersService, AssetMastersRepository],
  exports: [AssetMastersService],
})
export class AssetMastersModule {}
