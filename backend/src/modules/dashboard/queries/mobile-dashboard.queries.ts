import { UserStatus } from '../../users/constants/user.constants';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import {
  AnnouncementStatus,
  AnnouncementTargetType,
} from '../../announcements/constants/announcement.constants';

// Leave balances for a specific user in a given financial year
export const getMobileLeaveBalancesQuery = (userId: string, financialYear: string) => ({
  query: `
    SELECT 
      lb."leaveCategory",
      lb."totalAllocated"::numeric as "totalAllocated",
      lb."consumed"::numeric as "consumed",
      lb."carriedForward"::numeric as "carriedForward",
      lb."adjusted"::numeric as "adjusted",
      (lb."totalAllocated"::numeric - lb."consumed"::numeric)::numeric as "balance"
    FROM leave_balances lb
    WHERE lb."userId" = $1
      AND lb."financialYear" = $2
      AND lb."deletedAt" IS NULL
    ORDER BY lb."leaveCategory"
  `,
  params: [userId, financialYear],
});

// Upcoming festival/holiday (next upcoming one from holiday calendar config)
export const getUpcomingFestivalBannerQuery = (financialYear: string) => ({
  query: `
    SELECT 
      cs.value as "holidays"
    FROM configurations c
    JOIN config_settings cs ON cs."configId" = c.id
    WHERE c.module = $1
      AND c.key = $2
      AND cs."contextKey" = $3
      AND cs."isActive" = true
      AND cs."deletedAt" IS NULL
      AND c."deletedAt" IS NULL
    LIMIT 1
  `,
  params: [CONFIGURATION_MODULES.LEAVE, CONFIGURATION_KEYS.HOLIDAY_CALENDAR, financialYear],
});

// All festivals and holidays for the current financial year
export const getAllHolidaysQuery = (financialYear: string) => ({
  query: `
    SELECT 
      cs.value as "holidays"
    FROM configurations c
    JOIN config_settings cs ON cs."configId" = c.id
    WHERE c.module = $1
      AND c.key = $2
      AND cs."contextKey" = $3
      AND cs."isActive" = true
      AND cs."deletedAt" IS NULL
      AND c."deletedAt" IS NULL
    LIMIT 1
  `,
  params: [CONFIGURATION_MODULES.LEAVE, CONFIGURATION_KEYS.HOLIDAY_CALENDAR, financialYear],
});

// Latest announcements (published, active, targeted to user)
// targetId stores roleId (UUID) for ROLE targets, not role name
export const getLatestAnnouncementsQuery = (userId: string, limit: number) => ({
  query: `
    SELECT 
      a.id,
      a.title,
      a.message,
      a."startAt",
      a."expiryAt",
      a."publishedAt",
      a."createdAt"
    FROM announcements a
    LEFT JOIN announcement_targets at ON at."announcementId" = a.id AND at."deletedAt" IS NULL
    WHERE a.status = $1
      AND a."deletedAt" IS NULL
      AND (a."startAt" IS NULL OR a."startAt" <= NOW())
      AND (a."expiryAt" IS NULL OR a."expiryAt" > NOW())
      AND (
        at."targetType" = $2
        OR (at."targetType" = $3 AND at."targetId" = $4)
        OR (at."targetType" = $5 AND at."targetId" IN (
          SELECT ur."roleId" FROM user_roles ur
          WHERE ur."userId" = $4 AND ur."deletedAt" IS NULL
        ))
      )
    GROUP BY a.id
    ORDER BY a."publishedAt" DESC NULLS LAST, a."createdAt" DESC
    LIMIT $6
  `,
  params: [
    AnnouncementStatus.PUBLISHED,
    AnnouncementTargetType.ALL,
    AnnouncementTargetType.USER,
    userId,
    AnnouncementTargetType.ROLE,
    limit,
  ],
});

// Today's birthdays
export const getTodayBirthdaysQuery = (today: string) => ({
  query: `
    SELECT 
      id as "userId",
      CONCAT("firstName", ' ', "lastName") as "name",
      "employeeId",
      "profilePicture",
      "dateOfBirth" as "date"
    FROM users
    WHERE status = $1
      AND "dateOfBirth" IS NOT NULL
      AND "deletedAt" IS NULL
      AND TO_CHAR("dateOfBirth", 'MM-DD') = TO_CHAR($2::date, 'MM-DD')
    ORDER BY "firstName"
  `,
  params: [UserStatus.ACTIVE, today],
});

// Today's work anniversaries
export const getTodayAnniversariesQuery = (today: string) => ({
  query: `
    SELECT 
      id as "userId",
      CONCAT("firstName", ' ', "lastName") as "name",
      "employeeId",
      "profilePicture",
      "dateOfJoining" as "date",
      EXTRACT(YEAR FROM AGE($1::date, "dateOfJoining"))::int as "yearsCompleted"
    FROM users
    WHERE status = $2
      AND "dateOfJoining" IS NOT NULL
      AND "dateOfJoining" < $1::date
      AND "deletedAt" IS NULL
      AND TO_CHAR("dateOfJoining", 'MM-DD') = TO_CHAR($1::date, 'MM-DD')
    ORDER BY "firstName"
  `,
  params: [today, UserStatus.ACTIVE],
});

// Emergency contacts from dashboard config
export const getEmergencyContactsQuery = () => ({
  query: `
    SELECT 
      cs.value as "contacts"
    FROM configurations c
    JOIN config_settings cs ON cs."configId" = c.id
    WHERE c.module = $1
      AND c.key = $2
      AND cs."isActive" = true
      AND cs."deletedAt" IS NULL
      AND c."deletedAt" IS NULL
    LIMIT 1
  `,
  params: [CONFIGURATION_MODULES.DASHBOARD, CONFIGURATION_KEYS.DASHBOARD_EMERGENCY_CONTACTS],
});
