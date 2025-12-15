import { GetAllAnnouncementsDto } from '../dto/get-announcement.dto';
import {
  AnnouncementStatus,
  AnnouncementTargetType,
  ANNOUNCEMENT_SORT_FIELD_MAPPING,
} from '../constants/announcement.constants';

export const buildAnnouncementListQuery = (
  filters: GetAllAnnouncementsDto,
  isUserView: boolean,
) => {
  const {
    status,
    title,
    page,
    pageSize,
    sortField,
    sortOrder,
    userId,
    roleIds,
    unacknowledgedOnly,
  } = filters;

  const whereConditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition - not deleted
  whereConditions.push(`a."deletedAt" IS NULL`);

  if (isUserView && userId) {
    // User view - only published, active announcements
    whereConditions.push(`a."status" = $${paramIndex}`);
    params.push(AnnouncementStatus.PUBLISHED);
    paramIndex++;

    whereConditions.push(`(a."startAt" IS NULL OR a."startAt" <= NOW())`);
    whereConditions.push(`(a."expiryAt" IS NULL OR a."expiryAt" > NOW())`);

    // Target filtering
    const roleIdArray = roleIds && roleIds.length > 0 ? roleIds : [];
    whereConditions.push(`(
      t."targetType" = $${paramIndex}
      OR (t."targetType" = $${paramIndex + 1} AND t."targetId" = $${paramIndex + 2})
      ${
        roleIdArray.length > 0
          ? `OR (t."targetType" = $${paramIndex + 3} AND t."targetId" = ANY($${paramIndex + 4}))`
          : ''
      }
    )`);
    params.push(AnnouncementTargetType.ALL, AnnouncementTargetType.USER, userId);
    paramIndex += 3;

    if (roleIdArray.length > 0) {
      params.push(AnnouncementTargetType.ROLE, roleIdArray);
      paramIndex += 2;
    }
  } else {
    // Admin view - filter by status if provided
    if (status) {
      whereConditions.push(`a."status" = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
  }

  // Title search
  if (title) {
    whereConditions.push(`a."title" ILIKE $${paramIndex}`);
    params.push(`%${title}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const offset = ((page || 1) - 1) * (pageSize || 10);
  const orderColumn = ANNOUNCEMENT_SORT_FIELD_MAPPING[sortField] || 'a."createdAt"';
  const orderDir = sortOrder || 'DESC';

  let query: string;
  let countQuery: string;

  if (isUserView && userId) {
    // User view query with acknowledgement status
    query = `
      SELECT 
        a."id",
        a."title",
        a."message",
        a."status",
        a."startAt",
        a."expiryAt",
        a."createdAt",
        CASE WHEN ack."id" IS NOT NULL AND ack."acknowledged" = true THEN true ELSE false END as "acknowledged"
      FROM "announcements" a
      LEFT JOIN "announcement_targets" t ON a."id" = t."announcementId"
      LEFT JOIN "user_announcement_ack" ack ON a."id" = ack."announcementId" AND ack."userId" = $${paramIndex}
      ${whereClause}
      ${unacknowledgedOnly ? 'AND (ack."id" IS NULL OR ack."acknowledged" = false)' : ''}
      GROUP BY a."id", ack."id", ack."acknowledged"
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;
    params.push(userId, pageSize || 10, offset);

    countQuery = `
      SELECT COUNT(DISTINCT a."id") as total
      FROM "announcements" a
      LEFT JOIN "announcement_targets" t ON a."id" = t."announcementId"
      LEFT JOIN "user_announcement_ack" ack ON a."id" = ack."announcementId" AND ack."userId" = $${
        paramIndex - 2
      }
      ${whereClause}
      ${unacknowledgedOnly ? 'AND (ack."id" IS NULL OR ack."acknowledged" = false)' : ''}
    `;
  } else {
    // Admin view query with stats
    query = `
      SELECT 
        a."id",
        a."title",
        a."message",
        a."status",
        a."startAt",
        a."expiryAt",
        a."createdAt",
        a."updatedAt",
        a."createdBy",
        COUNT(ack."id") as "totalAck",
        SUM(CASE WHEN ack."acknowledged" = true THEN 1 ELSE 0 END) as "acknowledgedCount"
      FROM "announcements" a
      LEFT JOIN "user_announcement_ack" ack ON a."id" = ack."announcementId"
      ${whereClause}
      GROUP BY a."id"
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(pageSize || 10, offset);

    countQuery = `
      SELECT COUNT(*) as total
      FROM "announcements" a
      ${whereClause}
    `;
  }

  const countParams = params.slice(0, paramIndex - 1);

  return { query, countQuery, params, countParams };
};

export const buildAnnouncementTargetsQuery = (announcementId: string) => {
  return {
    query: `
      SELECT "id", "targetType", "targetId"
      FROM "announcement_targets"
      WHERE "announcementId" = $1 AND "deletedAt" IS NULL
    `,
    params: [announcementId],
  };
};

export const buildExpireAnnouncementsQuery = () => {
  return {
    query: `
      UPDATE "announcements" 
      SET "status" = $1 
      WHERE "status" = $2 
        AND "expiryAt" IS NOT NULL 
        AND "expiryAt" < NOW()
    `,
    params: [AnnouncementStatus.EXPIRED, AnnouncementStatus.PUBLISHED],
  };
};

export const buildAcknowledgementDetailsQuery = (announcementId: string) => {
  return {
    query: `
      SELECT 
        u."id" as "userId",
        u."firstName",
        u."lastName",
        u."email",
        COALESCE(ack."acknowledged", false) as "acknowledged",
        ack."acknowledgedAt"
      FROM "users" u
      INNER JOIN "user_announcement_ack" ack ON u."id" = ack."userId"
      WHERE ack."announcementId" = $1
        AND ack."deletedAt" IS NULL
        AND u."deletedAt" IS NULL
      ORDER BY ack."acknowledgedAt" DESC NULLS LAST, u."firstName" ASC
    `,
    params: [announcementId],
  };
};

export const buildUnacknowledgedAnnouncementsQuery = (userId: string, roleIds: string[]) => {
  const roleIdArray = roleIds && roleIds.length > 0 ? roleIds : [];

  const query = `
    SELECT DISTINCT
      a."id",
      a."title",
      a."message",
      a."status",
      a."startAt",
      a."expiryAt",
      a."createdAt"
    FROM "announcements" a
    LEFT JOIN "announcement_targets" t ON a."id" = t."announcementId"
    LEFT JOIN "user_announcement_ack" ack ON a."id" = ack."announcementId" AND ack."userId" = $1 AND ack."acknowledged" = true
    WHERE a."deletedAt" IS NULL
      AND a."status" = $2
      AND (a."startAt" IS NULL OR a."startAt" <= NOW())
      AND (a."expiryAt" IS NULL OR a."expiryAt" > NOW())
      AND ack."id" IS NULL
      AND (
        t."targetType" = $3
        OR (t."targetType" = $4 AND t."targetId" = $5)
        ${roleIdArray.length > 0 ? `OR (t."targetType" = $6 AND t."targetId" = ANY($7))` : ''}
      )
    ORDER BY a."createdAt" DESC
  `;

  const params: any[] = [
    userId,
    AnnouncementStatus.PUBLISHED,
    AnnouncementTargetType.ALL,
    AnnouncementTargetType.USER,
    userId,
  ];

  if (roleIdArray.length > 0) {
    params.push(AnnouncementTargetType.ROLE, roleIdArray);
  }

  return { query, params };
};
