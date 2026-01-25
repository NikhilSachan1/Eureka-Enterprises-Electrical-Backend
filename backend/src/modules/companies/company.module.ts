import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyRepository } from './company.repository';
import { CompanyEntity } from './entities/company.entity';
import { FilesModule } from '../common/file-upload/files.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity]), FilesModule, SharedModule],
  controllers: [CompanyController],
  providers: [CompanyService, CompanyRepository],
  exports: [CompanyService, CompanyRepository],
})
export class CompanyModule {}
