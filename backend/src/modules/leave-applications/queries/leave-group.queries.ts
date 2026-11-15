import { GetLeaveApplicationsDto } from '../dto';
import { LEAVE_APPLICATION_COLUMNS, LEAVE_APPLICATION_FROM } from './leave-queries.dto';

/** One application = the day rows sharing a group id; rows from before grouping stand alone. */
export const LEAVE_GROUP_KEY = `COALESCE(la."applicationGroupId", la."id")`;

/** Group-level sort expressions (the list sends the same sort fields as the day list). */
const LEAVE_GROUP_SORT: Record<string, string> = {
  createdAt: 'MIN(la."createdAt")',
  updatedAt: 'MAX(la."updatedAt")',
  fromDate: 'MIN(la."fromDate")',
  toDate: 'MAX(la."toDate")',
  fullName: `MIN(CONCAT(u."firstName", ' ', u."lastName"))`,
  firstName: 'MIN(u."firstName")',
  lastName: 'MIN(u."lastName")',
};

/** Day-level filters (same rules as the day list). An application matches when any day does. */
const buildLeaveDayConditions = (
  filters: GetLeaveApplicationsDto,
): { where: string; params: unknown[] } => {
  const { userIds, startDate, endDate, date, search, approvalStatuses, leaveTypes } = filters;
  const conditions: string[] = [];
  const params: unknown[] = [];
  const next = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (userIds?.length) conditions.push(`la."userId" = ANY(${next(userIds)})`);
  if (approvalStatuses?.length) {
    conditions.push(`la."approvalStatus" = ANY(${next(approvalStatuses)})`);
  }
  if (leaveTypes?.length) conditions.push(`la."leaveType" = ANY(${next(leaveTypes)})`);

  if (date) {
    conditions.push(`DATE(${next(date)}) BETWEEN DATE(la."fromDate") AND DATE(la."toDate")`);
  } else {
    if (startDate) conditions.push(`DATE(la."fromDate") >= DATE(${next(startDate)})`);
    if (endDate) conditions.push(`DATE(la."toDate") <= DATE(${next(endDate)})`);
  }

  if (search) {
    const pattern = next(`%${search.toLowerCase()}%`);
    conditions.push(`(
      LOWER(u."firstName") LIKE ${pattern} OR
      LOWER(u."lastName") LIKE ${pattern} OR
      LOWER(u."email") LIKE ${pattern} OR
      LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE ${pattern}
    )`);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
};

/** Applications having at least one day that matches the filters. */
const matchedGroupsCte = (where: string): string => `
  matched AS (
    SELECT DISTINCT ${LEAVE_GROUP_KEY} AS "groupId"
      FROM leave_applications la
      INNER JOIN users u ON la."userId" = u."id"
      ${where}
  )`;

/** One page of application ids, in list order. */
export const buildLeaveGroupPageQuery = (filters: GetLeaveApplicationsDto) => {
  const { page = 1, pageSize = 10, sortField, sortOrder } = filters;
  const { where, params } = buildLeaveDayConditions(filters);
  const sort = LEAVE_GROUP_SORT[sortField ?? ''] ?? LEAVE_GROUP_SORT.createdAt;
  const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  params.push(pageSize, (page - 1) * pageSize);
  const query = `
    WITH ${matchedGroupsCte(where)}
    SELECT ${LEAVE_GROUP_KEY} AS "groupId"
      FROM leave_applications la
      INNER JOIN users u ON la."userId" = u."id"
     WHERE ${LEAVE_GROUP_KEY} IN (SELECT "groupId" FROM matched)
     GROUP BY ${LEAVE_GROUP_KEY}
     ORDER BY ${sort} ${direction}, ${LEAVE_GROUP_KEY}
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  return { query, params };
};

/** Number of applications matching the filters. */
export const buildLeaveGroupCountQuery = (filters: GetLeaveApplicationsDto) => {
  const { where, params } = buildLeaveDayConditions(filters);
  return {
    query: `WITH ${matchedGroupsCte(where)} SELECT COUNT(*)::int AS total FROM matched`,
    params,
  };
};

/** Every day of the given applications (all days, not only the matching ones). */
export const buildLeaveGroupRecordsQuery = (groupIds: string[]) => ({
  query: `
    SELECT ${LEAVE_APPLICATION_COLUMNS},
           ${LEAVE_GROUP_KEY} AS "groupId"
    ${LEAVE_APPLICATION_FROM}
     WHERE ${LEAVE_GROUP_KEY} = ANY($1::uuid[])
     ORDER BY la."fromDate" ASC
  `,
  params: [groupIds],
});
