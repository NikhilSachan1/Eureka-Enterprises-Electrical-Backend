import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestAuditLogEntity } from './entities/request-audit-log.entity';
import { EntityAuditLogEntity } from './entities/entity-audit-log.entity';
import { AuditLogRepository } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { RequestAuditInterceptor } from './interceptors/request-audit.interceptor';
import { EntityAuditSubscriber } from './subscribers/entity-audit.subscriber';
import { SharedModule } from 'src/modules/shared/shared.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RequestAuditLogEntity, EntityAuditLogEntity]), SharedModule],
  controllers: [AuditLogController],
  providers: [AuditLogRepository, AuditLogService, RequestAuditInterceptor, EntityAuditSubscriber],
  exports: [AuditLogService, RequestAuditInterceptor],
})
export class AuditLogModule {}
