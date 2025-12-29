import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import { ExpireAnnouncementsResult } from '../types/announcement.types';
import {
  getAnnouncementsToExpireQuery,
  expireAnnouncementsByIdsQuery,
} from '../queries/announcement.queries';

@Injectable()
export class AnnouncementCronService {
  private readonly logger = new Logger(AnnouncementCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
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
  async handleExpireAnnouncements(): Promise<ExpireAnnouncementsResult> {
    const cronName = CRON_NAMES.EXPIRE_ANNOUNCEMENTS;
    this.schedulerService.logCronStart(cronName);

    const result: ExpireAnnouncementsResult = {
      expiredCount: 0,
      expiredIds: [],
      errors: [],
    };

    try {
      const { query: selectQuery, params: selectParams } = getAnnouncementsToExpireQuery();
      const announcementsToExpire = await this.dataSource.query(selectQuery, selectParams);

      if (announcementsToExpire.length === 0) {
        this.logger.log(`[${cronName}] No announcements to expire`);
        this.schedulerService.logCronComplete(cronName, result);
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

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }
}
