import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JmcController } from './jmc.controller';
import { JmcService } from './jmc.service';
import { JmcRepository } from './jmc.repository';
import { JmcPdfService } from './jmc-pdf.service';
import { JmcEntity } from './entities/jmc.entity';
import { JmcItemEntity } from './entities/jmc-item.entity';
import { JmcItemMasterEntity } from './entities/jmc-item-master.entity';
import { FilesModule } from 'src/modules/common/file-upload/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([JmcEntity, JmcItemEntity, JmcItemMasterEntity]), FilesModule],
  controllers: [JmcController],
  providers: [JmcService, JmcRepository, JmcPdfService],
  exports: [JmcService, JmcRepository],
})
export class JmcModule {}
