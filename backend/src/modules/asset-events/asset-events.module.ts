import { Module } from '@nestjs/common';
import { AssetEventsService } from './asset-events.service';
import { AssetEventsController } from './asset-events.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetEventEntity } from './entities/asset-event.entity';
import { AssetEventsRepository } from './asset-events.repository';
import { SharedModule } from '../shared/shared.module';
import { AssetFilesModule } from '../asset-files/asset-files.module';

@Module({
  imports: [TypeOrmModule.forFeature([AssetEventEntity]), SharedModule, AssetFilesModule],
  controllers: [AssetEventsController],
  providers: [AssetEventsService, AssetEventsRepository],
  exports: [AssetEventsService],
})
export class AssetEventsModule {}
