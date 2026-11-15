import { Module } from '@nestjs/common';
import { DocumentStatusController } from './document-status.controller';
import { DocumentStatusService } from './document-status.service';
import { DocumentMetricsController } from './document-metrics.controller';
import { DocumentMetricsService } from './document-metrics.service';

@Module({
  controllers: [DocumentStatusController, DocumentMetricsController],
  providers: [DocumentStatusService, DocumentMetricsService],
})
export class DocumentStatusModule {}
