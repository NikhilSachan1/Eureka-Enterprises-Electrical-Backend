import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Environments } from 'env-configs';
import { CRON_NAMES, CRON_SCHEDULES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import { NotificationService } from '../../notifications/notification.service';
import { DEVICE_STALE_DAYS } from '../../notifications/constants/notification.constants';

/** Never keep less than a month, whatever the setting says. */
const MIN_NOTIFICATION_RETENTION_DAYS = 30;

/**
 * CRON: bell retention
 *
 * Soft-deletes notifications older than `NOTIFICATION_RETENTION_DAYS` (default 90) so the bell
 * stays a list of recent things rather than every event since go-live.
 *
 * Separate from log retention on purpose: that one trims write-only audit tables, is switched off
 * by default, and hard-deletes. These are rows people read, so they are always trimmed and only
 * ever soft-deleted.
 */
@Injectable()
export class NotificationRetentionCronService {
  constructor(
    private readonly cronLogService: CronLogService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CRON_SCHEDULES.DAILY_2_30AM_IST)
  async handleNotificationRetention() {
    return this.cronLogService.execute(
      CRON_NAMES.NOTIFICATION_RETENTION_CLEANUP,
      CronJobType.NOTIFICATION,
      async () => {
        const days = Math.max(
          Number.isFinite(Environments.NOTIFICATION_RETENTION_DAYS)
            ? Environments.NOTIFICATION_RETENTION_DAYS
            : 90,
          MIN_NOTIFICATION_RETENTION_DAYS,
        );
        const removed = await this.notificationService.purgeOlderThan(days);
        return { retentionDays: days, removed };
      },
    );
  }

  /**
   * CRON: stale push devices
   *
   * Switches off devices not seen for `DEVICE_STALE_DAYS` (45) days, keeping each user's most
   * recently seen one — see `NotificationService.deactivateStaleDevices`. Runs at 2:45 AM IST.
   */
  @Cron(CRON_SCHEDULES.DAILY_2_45AM_IST)
  async handleStaleDeviceCleanup() {
    return this.cronLogService.execute(
      CRON_NAMES.NOTIFICATION_DEVICE_CLEANUP,
      CronJobType.NOTIFICATION,
      async () => {
        const deactivated = await this.notificationService.deactivateStaleDevices(
          DEVICE_STALE_DAYS,
        );
        return { staleAfterDays: DEVICE_STALE_DAYS, deactivated };
      },
    );
  }
}
