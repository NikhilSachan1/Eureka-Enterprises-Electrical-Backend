import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Environments } from 'env-configs';
import { CRON_NAMES, CRON_SCHEDULES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import { NotificationService } from '../../notifications/notification.service';

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
}
