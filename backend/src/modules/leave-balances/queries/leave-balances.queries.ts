import { GetAllLeaveBalanceDto } from '../dto';
import { LEAVE_BALANCE_SORT_FIELDS } from '../constants/leave-balances.constants';
import { getUserJsonBuildObject } from 'src/utils/utility/utility.service';

export const buildLeaveBalanceQuery = (options: GetAllLeaveBalanceDto) => {
  const { userIds, financialYear, page, pageSize, sortField, sortOrder } = options;
  const query = `
    SELECT 
      leave_balances.id,
      leave_balances."userId",
      leave_balances."leaveCategory",
      leave_balances."totalAllocated",
      leave_balances."consumed",
      leave_balances."financialYear",
      leave_balances."creditSource",
      leave_balances."carriedForward",
      leave_balances."adjusted",
      leave_balances."totalAllocated"::numeric - leave_balances."consumed"::numeric as balance,
      leave_balances."createdAt",
      ${getUserJsonBuildObject('u')} as user
    FROM leave_balances
    LEFT JOIN users u ON leave_balances."userId" = u.id
    WHERE leave_balances."deletedAt" IS NULL
    ${userIds ? `AND leave_balances."userId" IN (${userIds.map((id) => `'${id}'`).join(',')})` : ''}
    ${financialYear ? `AND leave_balances."financialYear" = '${financialYear}'` : ''}
    ${sortField && sortOrder ? `ORDER BY ${LEAVE_BALANCE_SORT_FIELDS[sortField]} ${sortOrder}` : ''}
    ${page && pageSize ? `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}` : ''}
  `;
  return query;
};
