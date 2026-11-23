import { Module } from '@nestjs/common';
import { DataSyncController } from './data-sync.controller';
import { DataSyncService } from './data-sync.service';

@Module({
  controllers: [DataSyncController],
  providers: [DataSyncService],
})
export class DataSyncModule {}
