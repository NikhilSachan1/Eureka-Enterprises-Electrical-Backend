import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationLogEntity } from './entities/communication-log.entity';
import { CommunicationLogRepository } from './communication-log.repository';
import { CommunicationLogService } from './communication-log.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CommunicationLogEntity])],
  providers: [CommunicationLogRepository, CommunicationLogService],
  exports: [CommunicationLogService],
})
export class CommunicationLogModule {}
