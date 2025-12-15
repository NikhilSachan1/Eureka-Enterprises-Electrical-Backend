import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementService } from './announcement.service';
import { AnnouncementController } from './announcement.controller';
import { AnnouncementRepository } from './announcement.repository';
import { AnnouncementEntity } from './entities/announcement.entity';
import { AnnouncementTargetEntity } from './entities/announcement-target.entity';
import { UserAnnouncementAckEntity } from './entities/user-announcement-ack.entity';
import { SharedModule } from '../shared/shared.module';
import { UserRoleModule } from '../user-roles/user-role.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnnouncementEntity,
      AnnouncementTargetEntity,
      UserAnnouncementAckEntity,
    ]),
    SharedModule,
    UserRoleModule,
  ],
  providers: [AnnouncementService, AnnouncementRepository],
  exports: [AnnouncementService],
  controllers: [AnnouncementController],
})
export class AnnouncementsModule {}
