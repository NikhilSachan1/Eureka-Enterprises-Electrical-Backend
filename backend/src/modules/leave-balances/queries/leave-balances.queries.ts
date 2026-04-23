import { GetAllLeaveBalanceDto } from '../dto';
import { LEAVE_BALANCE_SORT_FIELDS } from '../constants/leave-balances.constants';
import { getUserJsonBuildObject } from 'src/utils/utility/utility.service';

export const buildLeaveBalanceQuery = (options: GetAllLeaveBalanceDto) => {
  const { userIds, financialYear, sortField, sortOrder } = options;
  const params: any[] = [];

  const userFilter = userIds?.length
    ? (() => {
        params.push(userIds);
        return `AND "userId" = ANY($${params.length})`;
      })()
    : '';

  const fyFilter = financialYear
    ? (() => {
        params.push(financialYear);
        return `AND "financialYear" = $${params.length}`;
      })()
    : '';

  const orderBy =
    sortField && sortOrder ? `ORDER BY ${LEAVE_BALANCE_SORT_FIELDS[sortField]} ${sortOrder}` : '';

  const query = `
    SELECT
      lb.id,
      lb."userId",
      lb."leaveCategory",
      lb."financialYear",
      lb."creditSource",
      lb."totalAllocated",
      lb."carriedForward",
      lb."consumed",
      lb."adjusted",
      lb."notes",
      lb."createdAt",
      (
        lb."totalAllocated"::numeric
        + lb."carriedForward"::numeric
        + lb."adjusted"::numeric
        - lb."consumed"::numeric
      ) AS "availableBalance",
      ${getUserJsonBuildObject('u')} AS user
    FROM (
      SELECT DISTINCT ON ("userId", "leaveCategory", "financialYear") *
      FROM leave_balances
      WHERE "deletedAt" IS NULL
      ${userFilter}
      ${fyFilter}
      ORDER BY "userId", "leaveCategory", "financialYear", "totalAllocated"::numeric DESC
    ) lb
    LEFT JOIN users u ON lb."userId" = u.id
    ${orderBy}
  `;

  return { query, params };
};
