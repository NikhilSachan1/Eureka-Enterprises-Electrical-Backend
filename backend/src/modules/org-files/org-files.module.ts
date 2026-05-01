import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgFileNodeEntity } from './entities/org-file-node.entity';
import { OrgFilesRepository } from './org-files.repository';
import { OrgFilesService } from './org-files.service';
import { OrgFilesController } from './org-files.controller';
import { FilesModule } from 'src/modules/common/file-upload/files.module';
import { SharedModule } from 'src/modules/shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrgFileNodeEntity]), FilesModule, SharedModule],
  controllers: [OrgFilesController],
  providers: [OrgFilesService, OrgFilesRepository],
  exports: [OrgFilesService, OrgFilesRepository],
})
export class OrgFilesModule {}
