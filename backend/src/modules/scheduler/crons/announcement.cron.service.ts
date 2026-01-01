import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import {
  ExpireAnnouncementsResult,
  PublishScheduledAnnouncementsResult,
} from '../types/announcement.types';
import {
  getAnnouncementsToExpireQuery,
  expireAnnouncementsByIdsQuery,
  getScheduledAnnouncementsToPublishQuery,
  publishAnnouncementsByIdsQuery,
} from '../queries/announcement.queries';

@Injectable()
export class AnnouncementCronService {
  private readonly logger = new Logger(AnnouncementCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 9: Expire Announcements
   *
   * Runs daily at 6:00 AM IST
   * Marks PUBLISHED announcements as EXPIRED when their expiryAt date has passed.
   *
   * Process:
   * 1. Find all PUBLISHED announcements with expiryAt < NOW()
   * 2. Update their status to EXPIRED
   * 3. Log the expired announcement IDs for audit
   *
   * Does NOT affect:
   * - DRAFT announcements (never published)
   * - ARCHIVED announcements (already taken down)
   * - Announcements without expiry date (never expire)
   */
  @Cron(CRON_SCHEDULES.DAILY_6AM_IST)
  async handleExpireAnnouncements(): Promise<ExpireAnnouncementsResult | null> {
    const cronName = CRON_NAMES.EXPIRE_ANNOUNCEMENTS;

    return this.cronLogService.execute(cronName, CronJobType.ANNOUNCEMENT, async () => {
      const result: ExpireAnnouncementsResult = {
        expiredCount: 0,
        expiredIds: [],
        errors: [],
      };

      const { query: selectQuery, params: selectParams } = getAnnouncementsToExpireQuery();
      const announcementsToExpire = await this.dataSource.query(selectQuery, selectParams);

      if (announcementsToExpire.length === 0) {
        this.logger.log(`[${cronName}] No announcements to expire`);
        return result;
      }

      const ids = announcementsToExpire.map((announcement: any) => announcement.id);
      this.logger.log(`[${cronName}] Found ${ids.length} announcements to expire`);

      for (const announcement of announcementsToExpire) {
        this.logger.debug(
          `[${cronName}] Expiring: "${announcement.title}" (ID: ${announcement.id}, expiryAt: ${announcement.expiryAt})`,
        );
      }

      const { query: updateQuery, params: updateParams } = expireAnnouncementsByIdsQuery(ids);

      if (updateQuery) {
        await this.dataSource.query(updateQuery, updateParams);
        result.expiredCount = ids.length;
        result.expiredIds = ids;
      }

      this.logger.log(`[${cronName}] Successfully expired ${result.expiredCount} announcements`);

      return result;
    });
  }

  /**
   * CRON 10: Publish Scheduled Announcements
   *
   * Runs every 30 minutes
   * Auto-publishes DRAFT announcements when their scheduled startAt time arrives.
   *
   * Process:
   * 1. Find all DRAFT announcements with startAt <= NOW()
   * 2. Exclude those that are already expired (expiryAt < NOW())
   * 3. Update their status to PUBLISHED
   * 4. Set publishedAt timestamp for audit
   *
   * Does NOT affect:
   * - DRAFT without startAt (not scheduled)
   * - DRAFT with startAt in future (not yet time)
   * - DRAFT that would be immediately expired
   * - Already PUBLISHED / ARCHIVED / EXPIRED announcements
   */
  @Cron(CRON_SCHEDULES.EVERY_30_MINUTES)
  async handlePublishScheduledAnnouncements(): Promise<PublishScheduledAnnouncementsResult | null> {
    const cronName = CRON_NAMES.PUBLISH_ANNOUNCEMENTS;

    return this.cronLogService.execute(cronName, CronJobType.ANNOUNCEMENT, async () => {
      const result: PublishScheduledAnnouncementsResult = {
        publishedCount: 0,
        publishedIds: [],
        skippedExpiredCount: 0,
        errors: [],
      };

      const { query: selectQuery, params: selectParams } =
        getScheduledAnnouncementsToPublishQuery();
      const announcementsToPublish = await this.dataSource.query(selectQuery, selectParams);

      if (announcementsToPublish.length === 0) {
        this.logger.log(`[${cronName}] No scheduled announcements to publish`);
        return result;
      }

      const ids = announcementsToPublish.map((announcement: any) => announcement.id);
      this.logger.log(`[${cronName}] Found ${ids.length} announcements to publish`);

      for (const announcement of announcementsToPublish) {
        this.logger.debug(
          `[${cronName}] Publishing: "${announcement.title}" (ID: ${announcement.id}, startAt: ${announcement.startAt})`,
        );
      }

      const { query: updateQuery, params: updateParams } = publishAnnouncementsByIdsQuery(ids);

      if (updateQuery) {
        await this.dataSource.query(updateQuery, updateParams);
        result.publishedCount = ids.length;
        result.publishedIds = ids;
      }

      this.logger.log(
        `[${cronName}] Successfully published ${result.publishedCount} announcements`,
      );

      return result;
    });
  }
}
