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
