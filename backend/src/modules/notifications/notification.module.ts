import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { UserDeviceEntity } from './entities/user-device.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { FcmPushService } from './push/fcm-push.service';

/**
 * Global for the same reason the WhatsApp and communication-log modules are: some twenty services
 * across the app raise notifications, and each would otherwise need this added to its module.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity, UserDeviceEntity])],
  controllers: [NotificationController],
  providers: [NotificationService, FcmPushService],
  exports: [NotificationService],
})
export class NotificationModule {}
