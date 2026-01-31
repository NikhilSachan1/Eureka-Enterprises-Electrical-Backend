import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { SiteEntity } from '../sites/entities/site.entity';
import { SiteDocumentEntity } from '../site-documents/entities/site-document.entity';
import { ContractorEntity } from '../contractors/entities/contractor.entity';
import { SiteContractorEntity } from '../sites/entities/site-contractor.entity';
import { SiteAllocationEntity } from '../site-allocations/entities/site-allocation.entity';
import { VehicleMasterEntity } from '../vehicle-masters/entities/vehicle-master.entity';
import { VehicleVersionEntity } from '../vehicle-versions/entities/vehicle-versions.entity';
import { VehicleLogEntity } from '../vehicle-logs/entities/vehicle-log.entity';
import { DailyStatusReportEntity } from '../daily-status-reports/entities/daily-status-report.entity';
import { UserEntity } from '../users/entities/user.entity';
import { SharedModule } from '../shared/shared.module';
import { DateTimeModule } from 'src/utils/datetime';

/**
 * Analytics Module
 * Provides comprehensive analytics and reporting capabilities
 *
 * Features:
 * - Executive Dashboard: High-level business overview
 * - Site Profitability: Revenue, expense, and profit analysis
 * - Invoice Aging: Payment tracking and overdue alerts
 * - Contractor Performance: Contractor-wise metrics
 * - Employee Productivity: Employee-wise work analysis
 * - Vehicle Analytics: Fleet usage and anomaly tracking
 * - Site Health Score: Weighted health calculation
 * - Site Timeline: Event history tracking
 *
 * Note: This module uses raw SQL queries for optimal performance
 * on large datasets. It does not modify any data.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SiteEntity,
      SiteDocumentEntity,
      ContractorEntity,
      SiteContractorEntity,
      SiteAllocationEntity,
      VehicleMasterEntity,
      VehicleVersionEntity,
      VehicleLogEntity,
      DailyStatusReportEntity,
      UserEntity,
    ]),
    SharedModule,
    DateTimeModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
