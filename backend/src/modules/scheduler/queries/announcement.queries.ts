import { AnnouncementStatus } from '../../announcements/constants/announcement.constants';

/**
 * CRON 9
 * Expire Announcements
 */
export const getAnnouncementsToExpireQuery = () => {
  return {
    query: `
      SELECT id, title, "expiryAt"
      FROM announcements
      WHERE status = $1
        AND "expiryAt" IS NOT NULL
        AND "expiryAt" < NOW()
        AND "deletedAt" IS NULL
    `,
    params: [AnnouncementStatus.PUBLISHED],
  };
};

export const expireAnnouncementsByIdsQuery = (ids: string[]) => {
  if (ids.length === 0) {
    return { query: '', params: [] };
  }

  const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');

  return {
    query: `
      UPDATE announcements
      SET status = $1,
          "expiredAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id IN (${placeholders})
        AND "deletedAt" IS NULL
    `,
    params: [AnnouncementStatus.EXPIRED, ...ids],
  };
};

/**
 * CRON 10
 * Publish Scheduled Announcements
 *
 * Get DRAFT announcements that are scheduled to be published:
 * - startAt is set and startAt <= NOW()
 * - Not already expired (expiryAt is null OR expiryAt > NOW())
 */
export const getScheduledAnnouncementsToPublishQuery = () => {
  return {
    query: `
      SELECT id, title, "startAt", "expiryAt"
      FROM announcements
      WHERE status = $1
        AND "startAt" IS NOT NULL
        AND "startAt" <= NOW()
        AND ("expiryAt" IS NULL OR "expiryAt" > NOW())
        AND "deletedAt" IS NULL
    `,
    params: [AnnouncementStatus.DRAFT],
  };
};

export const publishAnnouncementsByIdsQuery = (ids: string[]) => {
  if (ids.length === 0) {
    return { query: '', params: [] };
  }

  const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');

  return {
    query: `
      UPDATE announcements
      SET status = $1,
          "publishedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id IN (${placeholders})
        AND "deletedAt" IS NULL
    `,
    params: [AnnouncementStatus.PUBLISHED, ...ids],
  };
};
