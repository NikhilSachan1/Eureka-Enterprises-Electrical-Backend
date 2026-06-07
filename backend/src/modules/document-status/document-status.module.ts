import { Module } from '@nestjs/common';
import { DocumentStatusController } from './document-status.controller';
import { DocumentStatusService } from './document-status.service';

@Module({
  controllers: [DocumentStatusController],
  providers:   [DocumentStatusService],
})
export class DocumentStatusModule {}
