/**
 * Celebration Queries
 *
 * Queries for CRON 17: Birthday and Work Anniversary Wishes
 *
 * Fetches employees who have:
 * - Birthday today (matching month and day)
 * - Work anniversary today (matching month and day of dateOfJoining)
 *
 * Handles:
 * - February 29 birthdays (celebrated on Feb 28 in non-leap years)
 * - Active employees only (status = 'ACTIVE', deletedAt IS NULL)
 */

export const getBirthdayEmployeesQuery = () => {
  return {
    query: `
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.email,
        u."dateOfBirth",
        u."profilePicture",
        u.designation
      FROM users u
      WHERE u."deletedAt" IS NULL
        AND u.status = 'ACTIVE'
        AND u."dateOfBirth" IS NOT NULL
        AND (
          -- Normal case: birthday matches today's month and day
          (
            EXTRACT(MONTH FROM u."dateOfBirth") = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(DAY FROM u."dateOfBirth") = EXTRACT(DAY FROM CURRENT_DATE)
          )
          OR
          -- Leap year case: Feb 29 birthdays celebrated on Feb 28 in non-leap years
          (
            EXTRACT(MONTH FROM u."dateOfBirth") = 2
            AND EXTRACT(DAY FROM u."dateOfBirth") = 29
            AND EXTRACT(MONTH FROM CURRENT_DATE) = 2
            AND EXTRACT(DAY FROM CURRENT_DATE) = 28
            AND NOT (
              EXTRACT(YEAR FROM CURRENT_DATE)::int % 4 = 0
              AND (
                EXTRACT(YEAR FROM CURRENT_DATE)::int % 100 != 0
                OR EXTRACT(YEAR FROM CURRENT_DATE)::int % 400 = 0
              )
            )
          )
        )
      ORDER BY u."firstName", u."lastName"
    `,
    params: [],
  };
};

export const getAnniversaryEmployeesQuery = () => {
  return {
    query: `
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.email,
        u."dateOfJoining",
        u."profilePicture",
        u.designation,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, u."dateOfJoining"))::int as "yearsOfService"
      FROM users u
      WHERE u."deletedAt" IS NULL
        AND u.status = 'ACTIVE'
        AND u."dateOfJoining" IS NOT NULL
        -- Must have completed at least 1 year
        AND u."dateOfJoining" <= CURRENT_DATE - INTERVAL '1 year'
        AND (
          -- Normal case: anniversary matches today's month and day
          (
            EXTRACT(MONTH FROM u."dateOfJoining") = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(DAY FROM u."dateOfJoining") = EXTRACT(DAY FROM CURRENT_DATE)
          )
          OR
          -- Leap year case: Feb 29 anniversaries celebrated on Feb 28 in non-leap years
          (
            EXTRACT(MONTH FROM u."dateOfJoining") = 2
            AND EXTRACT(DAY FROM u."dateOfJoining") = 29
            AND EXTRACT(MONTH FROM CURRENT_DATE) = 2
            AND EXTRACT(DAY FROM CURRENT_DATE) = 28
            AND NOT (
              EXTRACT(YEAR FROM CURRENT_DATE)::int % 4 = 0
              AND (
                EXTRACT(YEAR FROM CURRENT_DATE)::int % 100 != 0
                OR EXTRACT(YEAR FROM CURRENT_DATE)::int % 400 = 0
              )
            )
          )
        )
      ORDER BY "yearsOfService" DESC, u."firstName", u."lastName"
    `,
    params: [],
  };
};

export const getMilestoneMessage = (years: number): string | null => {
  const milestoneMessages: Record<number, string> = {
    1: "Congratulations on completing your first year! Here's to many more successful years ahead!",
    5: 'Half a decade of excellence! Your dedication and hard work have been truly remarkable.',
    10: 'A decade of dedication! Your journey with us has been nothing short of inspiring.',
    15: "15 years of unwavering commitment! You're a true pillar of our organization.",
    20: 'Two decades of excellence! Your loyalty and contributions are deeply valued.',
    25: 'A silver jubilee celebration! 25 years of exceptional service and dedication.',
    30: 'Three decades of dedication! Your legacy at our organization is truly remarkable.',
    35: '35 years of excellence! Your commitment continues to inspire generations.',
    40: 'Four decades of dedication! A truly legendary milestone in your career.',
  };

  return milestoneMessages[years] || null;
};

export const isMilestoneYear = (years: number): boolean => {
  return [1, 5, 10, 15, 20, 25, 30, 35, 40].includes(years);
};

export const getYearsText = (years: number): string => {
  if (years === 1) {
    return '1 Year';
  }
  return `${years} Years`;
};

/**
 * Parameterized queries for manual trigger with specific date
 */
export const getBirthdayEmployeesForDateQuery = (targetDate: string) => {
  return {
    query: `
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.email,
        u."dateOfBirth",
        u."profilePicture",
        u.designation
      FROM users u
      WHERE u."deletedAt" IS NULL
        AND u.status = 'ACTIVE'
        AND u."dateOfBirth" IS NOT NULL
        AND (
          -- Normal case: birthday matches target date's month and day
          (
            EXTRACT(MONTH FROM u."dateOfBirth") = EXTRACT(MONTH FROM $1::date)
            AND EXTRACT(DAY FROM u."dateOfBirth") = EXTRACT(DAY FROM $1::date)
          )
          OR
          -- Leap year case: Feb 29 birthdays celebrated on Feb 28 in non-leap years
          (
            EXTRACT(MONTH FROM u."dateOfBirth") = 2
            AND EXTRACT(DAY FROM u."dateOfBirth") = 29
            AND EXTRACT(MONTH FROM $1::date) = 2
            AND EXTRACT(DAY FROM $1::date) = 28
            AND NOT (
              EXTRACT(YEAR FROM $1::date)::int % 4 = 0
              AND (
                EXTRACT(YEAR FROM $1::date)::int % 100 != 0
                OR EXTRACT(YEAR FROM $1::date)::int % 400 = 0
              )
            )
          )
        )
      ORDER BY u."firstName", u."lastName"
    `,
    params: [targetDate],
  };
};

export const getAnniversaryEmployeesForDateQuery = (targetDate: string) => {
  return {
    query: `
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.email,
        u."dateOfJoining",
        u."profilePicture",
        u.designation,
        EXTRACT(YEAR FROM AGE($1::date, u."dateOfJoining"))::int as "yearsOfService"
      FROM users u
      WHERE u."deletedAt" IS NULL
        AND u.status = 'ACTIVE'
        AND u."dateOfJoining" IS NOT NULL
        -- Must have completed at least 1 year
        AND u."dateOfJoining" <= $1::date - INTERVAL '1 year'
        AND (
          -- Normal case: anniversary matches target date's month and day
          (
            EXTRACT(MONTH FROM u."dateOfJoining") = EXTRACT(MONTH FROM $1::date)
            AND EXTRACT(DAY FROM u."dateOfJoining") = EXTRACT(DAY FROM $1::date)
          )
          OR
          -- Leap year case: Feb 29 anniversaries celebrated on Feb 28 in non-leap years
          (
            EXTRACT(MONTH FROM u."dateOfJoining") = 2
            AND EXTRACT(DAY FROM u."dateOfJoining") = 29
            AND EXTRACT(MONTH FROM $1::date) = 2
            AND EXTRACT(DAY FROM $1::date) = 28
            AND NOT (
              EXTRACT(YEAR FROM $1::date)::int % 4 = 0
              AND (
                EXTRACT(YEAR FROM $1::date)::int % 100 != 0
                OR EXTRACT(YEAR FROM $1::date)::int % 400 = 0
              )
            )
          )
        )
      ORDER BY "yearsOfService" DESC, u."firstName", u."lastName"
    `,
    params: [targetDate],
  };
};
