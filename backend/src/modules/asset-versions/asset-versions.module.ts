import { Module } from '@nestjs/common';
import { AssetVersionsService } from './asset-versions.service';
import { AssetVersionsController } from './asset-versions.controller';
import { AssetFilesModule } from '../asset-files/asset-files.module';
import { AssetEventsModule } from '../asset-events/asset-events.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetVersionEntity } from './entities/asset-versions.entity';
import { AssetVersionsRepository } from './asset-versions.repository';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetVersionEntity]),
    AssetFilesModule,
    AssetEventsModule,
    SharedModule,
  ],
  controllers: [AssetVersionsController],
  providers: [AssetVersionsService, AssetVersionsRepository],
  exports: [AssetVersionsService],
})
export class AssetVersionsModule {}
