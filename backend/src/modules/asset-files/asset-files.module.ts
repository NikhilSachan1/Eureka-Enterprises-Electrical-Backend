import { Module } from '@nestjs/common';
import { AssetFilesService } from './asset-files.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetFileEntity } from './entities/asset-file.entity';
import { AssetFilesRepository } from './asset-files.repository';
import { SharedModule } from '../shared/shared.module';
// import { AssetFilesController } from './asset-files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AssetFileEntity]), SharedModule],
  // controllers: [AssetFilesController],
  providers: [AssetFilesService, AssetFilesRepository],
  exports: [AssetFilesService],
})
export class AssetFilesModule {}
