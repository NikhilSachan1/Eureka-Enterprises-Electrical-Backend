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
