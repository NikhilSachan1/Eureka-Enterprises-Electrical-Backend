/**
 * CRON 9
 * Expire Announcements
 * Runs daily at 6:00 AM IST
 *
 * Marks PUBLISHED announcements as EXPIRED when their expiryAt date has passed.
 * Only affects announcements that:
 * - Have status = PUBLISHED
 * - Have expiryAt date set (not null)
 * - Have expiryAt < current time
 *
 * Does NOT affect:
 * - DRAFT announcements (never published, can still be edited)
 * - ARCHIVED announcements (already taken down)
 * - Announcements without expiry date (never expire)
 */
export interface ExpireAnnouncementsResult {
  expiredCount: number;
  expiredIds: string[];
  errors: string[];
}

/**
 * CRON 10
 * Publish Scheduled Announcements
 * Runs every 30 minutes
 *
 * Auto-publishes DRAFT announcements when their scheduled startAt time arrives.
 * Only affects announcements that:
 * - Have status = DRAFT
 * - Have startAt date set and startAt <= NOW()
 * - Are not already expired (expiryAt is null OR expiryAt > NOW())
 *
 * Does NOT affect:
 * - DRAFT without startAt (not scheduled)
 * - DRAFT with startAt in future (not yet time)
 * - DRAFT that would be immediately expired
 * - Already PUBLISHED / ARCHIVED / EXPIRED announcements
 */
export interface PublishScheduledAnnouncementsResult {
  publishedCount: number;
  publishedIds: string[];
  skippedExpiredCount: number;
  errors: string[];
}
