import { GetLeaveApplicationsDto } from '../dto';
import { LEAVE_APPLICATION_SORTABLE_FIELDS } from '../constants/leave-application.constants';

export const buildLeaveApplicationListQuery = (filters: GetLeaveApplicationsDto) => {
  const {
    userIds,
    startDate,
    endDate,
    date,
    search,
    approvalStatuses,
    leaveTypes,
    page = 1,
    pageSize = 10,
    sortField,
    sortOrder,
  } = filters;

  // Base query with joins
  let query = `
    SELECT
        la."id",
        la."userId",
        la."leaveConfigId",
        la."leaveType",
        la."leaveCategory",
        la."entrySourceType",
        la."leaveApplicationType",
        la."fromDate",
        la."toDate",
        la."reason",
        la."approvalStatus",
        la."approvalBy",
        la."approvalAt",
        la."approvalReason",
        la."createdAt",
        la."updatedAt",
        la."createdBy",
        la."updatedBy",
        -- User information
        u."firstName",
        u."lastName",
        u."email",
        u."contactNumber",
        -- Approver information
        approver."firstName" as "approverFirstName",
        approver."lastName" as "approverLastName",
        approver."email" as "approverEmail",
        -- Created by
        creator."firstName" as "createdByFirstName",
        creator."lastName" as "createdByLastName",
        creator."email" as "createdByEmail"
    FROM leave_applications la
    INNER JOIN users u ON la."userId" = u."id"
    LEFT JOIN users approver ON la."approvalBy" = approver."id"
    LEFT JOIN users creator ON la."createdBy" = creator."id"
  `;

  // WHERE conditions
  const conditions: string[] = [];
  const params: any[] = [];
  let paramCounter = 1;

  // Filter by user IDs
  if (userIds && userIds.length > 0) {
    conditions.push(`la."userId" = ANY($${paramCounter})`);
    params.push(userIds);
    paramCounter++;
  }

  // Filter by approval statuses
  if (approvalStatuses && approvalStatuses.length > 0) {
    conditions.push(`la."approvalStatus" = ANY($${paramCounter})`);
    params.push(approvalStatuses);
    paramCounter++;
  }

  // Filter by leave types
  if (leaveTypes && leaveTypes.length > 0) {
    conditions.push(`la."leaveType" = ANY($${paramCounter})`);
    params.push(leaveTypes);
    paramCounter++;
  }

  // Date filtering
  if (date) {
    conditions.push(`DATE($${paramCounter}) BETWEEN DATE(la."fromDate") AND DATE(la."toDate")`);
    params.push(date);
    paramCounter++;
  } else {
    if (startDate) {
      conditions.push(`DATE(la."fromDate") >= DATE($${paramCounter})`);
      params.push(startDate);
      paramCounter++;
    }
    if (endDate) {
      conditions.push(`DATE(la."toDate") <= DATE($${paramCounter})`);
      params.push(endDate);
      paramCounter++;
    }
  }

  // Search functionality
  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`;
    conditions.push(`(
      LOWER(u."firstName") LIKE $${paramCounter} OR
      LOWER(u."lastName") LIKE $${paramCounter} OR
      LOWER(u."email") LIKE $${paramCounter} OR
      LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE $${paramCounter}
    )`);
    params.push(searchPattern);
    paramCounter++;
  }

  // Add WHERE clause if conditions exist
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  // Sorting - Much cleaner approach!
  const sortFieldMapping =
    LEAVE_APPLICATION_SORTABLE_FIELDS[sortField as keyof typeof LEAVE_APPLICATION_SORTABLE_FIELDS];
  const validSortField = sortFieldMapping || LEAVE_APPLICATION_SORTABLE_FIELDS.createdAt;

  query += ` ORDER BY ${validSortField} ${sortOrder}`;

  // Pagination
  const offset = (page - 1) * pageSize;
  query += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
  params.push(pageSize, offset);

  return { query, params };
};

export const buildLeaveApplicationCountQuery = (filters: GetLeaveApplicationsDto) => {
  const { userIds, startDate, endDate, date, search, approvalStatuses, leaveTypes } = filters;

  let query = `
    SELECT COUNT(DISTINCT la."id") as total
    FROM leave_applications la
    INNER JOIN users u ON la."userId" = u."id"
  `;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramCounter = 1;

  // Apply the same filters as the main query
  if (userIds && userIds.length > 0) {
    conditions.push(`la."userId" = ANY($${paramCounter})`);
    params.push(userIds);
    paramCounter++;
  }

  if (approvalStatuses && approvalStatuses.length > 0) {
    conditions.push(`la."approvalStatus" = ANY($${paramCounter})`);
    params.push(approvalStatuses);
    paramCounter++;
  }

  if (leaveTypes && leaveTypes.length > 0) {
    conditions.push(`la."leaveType" = ANY($${paramCounter})`);
    params.push(leaveTypes);
    paramCounter++;
  }

  if (date) {
    conditions.push(`DATE($${paramCounter}) BETWEEN DATE(la."fromDate") AND DATE(la."toDate")`);
    params.push(date);
    paramCounter++;
  } else {
    if (startDate) {
      conditions.push(`DATE(la."fromDate") >= DATE($${paramCounter})`);
      params.push(startDate);
      paramCounter++;
    }
    if (endDate) {
      conditions.push(`DATE(la."toDate") <= DATE($${paramCounter})`);
      params.push(endDate);
      paramCounter++;
    }
  }

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`;
    conditions.push(`(
      LOWER(u."firstName") LIKE $${paramCounter} OR
      LOWER(u."lastName") LIKE $${paramCounter} OR
      LOWER(u."email") LIKE $${paramCounter} OR
      LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE $${paramCounter}
    )`);
    params.push(searchPattern);
    paramCounter++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { query, params };
};

export const buildLeaveApplicationStatsQuery = (filters: GetLeaveApplicationsDto) => {
  const { userIds, startDate, endDate, date, search, approvalStatuses, leaveTypes } = filters;

  let query = `
    SELECT 
      la."approvalStatus",
      COUNT(*) as count
    FROM leave_applications la
    INNER JOIN users u ON la."userId" = u."id"
  `;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramCounter = 1;

  // Apply the same filters as the main query
  if (userIds && userIds.length > 0) {
    conditions.push(`la."userId" = ANY($${paramCounter})`);
    params.push(userIds);
    paramCounter++;
  }

  if (approvalStatuses && approvalStatuses.length > 0) {
    conditions.push(`la."approvalStatus" = ANY($${paramCounter})`);
    params.push(approvalStatuses);
    paramCounter++;
  }

  if (leaveTypes && leaveTypes.length > 0) {
    conditions.push(`la."leaveType" = ANY($${paramCounter})`);
    params.push(leaveTypes);
    paramCounter++;
  }

  if (date) {
    conditions.push(`DATE($${paramCounter}) BETWEEN DATE(la."fromDate") AND DATE(la."toDate")`);
    params.push(date);
    paramCounter++;
  } else {
    if (startDate) {
      conditions.push(`DATE(la."fromDate") >= DATE($${paramCounter})`);
      params.push(startDate);
      paramCounter++;
    }
    if (endDate) {
      conditions.push(`DATE(la."toDate") <= DATE($${paramCounter})`);
      params.push(endDate);
      paramCounter++;
    }
  }

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`;
    conditions.push(`(
      LOWER(u."firstName") LIKE $${paramCounter} OR
      LOWER(u."lastName") LIKE $${paramCounter} OR
      LOWER(u."email") LIKE $${paramCounter} OR
      LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE $${paramCounter}
    )`);
    params.push(searchPattern);
    paramCounter++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` GROUP BY la."approvalStatus"`;

  return { query, params };
};

export const buildUniqueUserIdsQuery = (filters: GetLeaveApplicationsDto) => {
  const { userIds, startDate, endDate, date, search, approvalStatuses, leaveTypes } = filters;

  let query = `
    SELECT DISTINCT la."userId"
    FROM leave_applications la
    INNER JOIN users u ON la."userId" = u."id"
  `;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramCounter = 1;

  // Apply the same filters as the main query
  if (userIds && userIds.length > 0) {
    conditions.push(`la."userId" = ANY($${paramCounter})`);
    params.push(userIds);
    paramCounter++;
  }

  if (approvalStatuses && approvalStatuses.length > 0) {
    conditions.push(`la."approvalStatus" = ANY($${paramCounter})`);
    params.push(approvalStatuses);
    paramCounter++;
  }

  if (leaveTypes && leaveTypes.length > 0) {
    conditions.push(`la."leaveType" = ANY($${paramCounter})`);
    params.push(leaveTypes);
    paramCounter++;
  }

  if (date) {
    conditions.push(`DATE($${paramCounter}) BETWEEN DATE(la."fromDate") AND DATE(la."toDate")`);
    params.push(date);
    paramCounter++;
  } else {
    if (startDate) {
      conditions.push(`DATE(la."fromDate") >= DATE($${paramCounter})`);
      params.push(startDate);
      paramCounter++;
    }
    if (endDate) {
      conditions.push(`DATE(la."toDate") <= DATE($${paramCounter})`);
      params.push(endDate);
      paramCounter++;
    }
  }

  if (search) {
    const searchPattern = `%${search.toLowerCase()}%`;
    conditions.push(`(
      LOWER(u."firstName") LIKE $${paramCounter} OR
      LOWER(u."lastName") LIKE $${paramCounter} OR
      LOWER(u."email") LIKE $${paramCounter} OR
      LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE $${paramCounter}
    )`);
    params.push(searchPattern);
    paramCounter++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { query, params };
};
