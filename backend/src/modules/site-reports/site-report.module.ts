import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteReportController } from './site-report.controller';
import { SiteReportService } from './site-report.service';
import { SiteReportRepository } from './site-report.repository';
import { SiteReportEntity } from './entities/site-report.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SiteReportEntity])],
  controllers: [SiteReportController],
  providers: [SiteReportService, SiteReportRepository],
  exports: [SiteReportService, SiteReportRepository],
})
export class SiteReportModule {}
